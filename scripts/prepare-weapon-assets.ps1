[CmdletBinding()]
param(
    [string]$Archive = "",
    [string]$SourceFile = "",
    [string]$ModelKey = "",
    [string]$ModelEntry = "",
    [switch]$ListOnly
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$validKeys = @("pulseRifle", "novaCannon", "arcLance", "gravityCore")
if ($Archive -and $SourceFile) { throw "Choose either -Archive or -SourceFile, not both." }
if (!$Archive -and !$SourceFile) { throw "Supply -Archive (a ZIP in Assets/) or -SourceFile (a self-contained GLB in Assets/)." }
if ($ModelKey -and $validKeys -notcontains $ModelKey) {
    throw "Unknown ModelKey '$ModelKey'. Valid keys: $($validKeys -join ', ')"
}

$publicRoot = Join-Path $repoRoot "public"
$catalogPath = Join-Path (Join-Path $publicRoot "assets") "asset-catalog.json"
$catalog = $null
if (Test-Path -LiteralPath $catalogPath -PathType Leaf) {
    try { $catalog = Get-Content -LiteralPath $catalogPath -Raw | ConvertFrom-Json }
    catch { throw "Existing asset catalog is invalid JSON: $catalogPath" }
}
if ($null -eq $catalog) { $catalog = [PSCustomObject]@{} }
if ($null -eq $catalog.weaponModels) {
    $catalog | Add-Member -NotePropertyName weaponModels -NotePropertyValue ([PSCustomObject]@{}) -Force
}
$catalog | Add-Member -NotePropertyName schemaVersion -NotePropertyValue 1 -Force

$extractRoot = Join-Path (Join-Path (Join-Path $publicRoot "assets") "weapons") "imported"
New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null

if ($SourceFile) {
    if (!$ModelKey) { throw "-ModelKey is required for standalone imports." }
    $sourcePath = Join-Path $repoRoot $SourceFile
    if (!(Test-Path -LiteralPath $sourcePath -PathType Leaf)) { throw "Source file not found: $sourcePath" }
    if ([IO.Path]::GetExtension($sourcePath).ToLowerInvariant() -ne ".glb") {
        throw "Standalone imports must be self-contained .glb files. Use an archive for .gltf plus dependencies."
    }
    $info = Get-Item -LiteralPath $sourcePath
    if ($info.Length -lt 512) {
        $sample = Get-Content -LiteralPath $sourcePath -Raw -ErrorAction SilentlyContinue
        if ($sample -match "version https://git-lfs.github.com/spec/v1") { throw "Git LFS pointer detected; pull this source GLB first." }
        throw "Source GLB is unexpectedly small."
    }
    $targetDir = Join-Path $extractRoot $ModelKey
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    $targetFile = Join-Path $targetDir ([IO.Path]::GetFileName($sourcePath))
    Copy-Item -LiteralPath $sourcePath -Destination $targetFile -Force
    $publicRootFull = [IO.Path]::GetFullPath($publicRoot).TrimEnd([char]92, [char]47)
    $runtimePath = $targetFile.Substring($publicRootFull.Length).TrimStart([char]92, [char]47).Replace([char]92, '/')
    $catalog.weaponModels | Add-Member -NotePropertyName $ModelKey -NotePropertyValue ([PSCustomObject]@{
        file = $runtimePath
        sourceFile = $SourceFile
        transform = @{
            scale = 1
            position = @(0, 0, 0)
            rotation = @(0, 0, 0)
            targetLength = 0.85
        }
        selectionNote = "Imported from a standalone GLB. Review pivot, grip, orientation, PBR, dimensions, and redistribution rights before release."
    }) -Force
    $catalog | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $catalogPath -Encoding UTF8
    Write-Host "Mapped weapon $ModelKey -> $runtimePath" -ForegroundColor Green
    Write-Warning "The model is staged but not yet visually fitted to the player hand. Review it in-game before release."
    return
}

$archivePath = Join-Path (Join-Path $repoRoot "Assets") $Archive
if (!(Test-Path -LiteralPath $archivePath -PathType Leaf)) { throw "Archive not found: $archivePath. Run a targeted git lfs pull first." }
$archiveInfo = Get-Item -LiteralPath $archivePath
if ($archiveInfo.Length -lt 512) {
    $sample = Get-Content -LiteralPath $archivePath -Raw -ErrorAction SilentlyContinue
    if ($sample -match "version https://git-lfs.github.com/spec/v1") { throw "Git LFS pointer detected; pull this source archive first." }
    throw "Archive is unexpectedly small."
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    $allowed = @(".glb", ".gltf", ".bin", ".png", ".jpg", ".jpeg", ".tga", ".webp", ".ktx2", ".exr", ".hdr", ".json", ".txt", ".mtl", ".obj")
    $entries = @($zip.Entries | Where-Object { $_.Name -and $allowed -contains [IO.Path]::GetExtension($_.Name).ToLowerInvariant() })
    $models = @($entries | Where-Object { [IO.Path]::GetExtension($_.Name).ToLowerInvariant() -in @(".glb", ".gltf") })
    Write-Host "Browser-runtime weapon models in $Archive : $($models.Count)" -ForegroundColor Cyan
    $models | Select-Object FullName, @{Name="SizeMB";Expression={[math]::Round($_.Length / 1MB, 2)}} | Format-Table -AutoSize
    if ($ListOnly -or !$ModelKey) {
        Write-Host "Review the candidate and supply -ModelKey plus -ModelEntry to import one weapon model."
        return
    }

    $selected = $null
    if ($ModelEntry) {
        $selected = $models | Where-Object { $_.FullName -eq $ModelEntry } | Select-Object -First 1
        if (!$selected) { throw "ModelEntry '$ModelEntry' is not a GLB/GLTF entry in this archive." }
    } elseif ($models.Count -eq 1) { $selected = $models[0] }
    else { throw "Multiple models found. Run -ListOnly and select an exact -ModelEntry." }

    $targetRoot = Join-Path $extractRoot $ModelKey
    New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null
    $targetRootFull = [IO.Path]::GetFullPath($targetRoot)
    $separator = [IO.Path]::DirectorySeparatorChar
    $prefix = $targetRootFull.TrimEnd([char]92, [char]47) + $separator
    foreach ($entry in $entries) {
        $segments = @($entry.FullName -split '[\\/]')
        if ([IO.Path]::IsPathRooted($entry.FullName) -or $segments -contains '..') {
            Write-Warning "Skipping unsafe archive path: $($entry.FullName)"
            continue
        }
        $relative = [IO.Path]::Combine([string[]]$segments)
        $destination = [IO.Path]::GetFullPath((Join-Path $targetRootFull $relative))
        if (!$destination.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
            Write-Warning "Skipping path outside extraction root: $($entry.FullName)"
            continue
        }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination, $true)
    }
    $selectedSegments = @($selected.FullName -split '[\\/]')
    $selectedPath = Join-Path $targetRootFull ([IO.Path]::Combine([string[]]$selectedSegments))
    if (!(Test-Path -LiteralPath $selectedPath -PathType Leaf)) { throw "Selected weapon model was not extracted." }
    $publicRootFull = [IO.Path]::GetFullPath($publicRoot).TrimEnd([char]92, [char]47)
    $runtimePath = $selectedPath.Substring($publicRootFull.Length).TrimStart([char]92, [char]47).Replace([char]92, '/')
    $catalog.weaponModels | Add-Member -NotePropertyName $ModelKey -NotePropertyValue ([PSCustomObject]@{
        file = $runtimePath
        sourceArchive = $Archive
        archiveEntry = $selected.FullName
        transform = @{ scale = 1; position = @(0, 0, 0); rotation = @(0, 0, 0); targetLength = 0.85 }
        selectionNote = "Imported from the source archive. Review pivot, grip, orientation, PBR, dimensions, and redistribution rights before release."
    }) -Force
    $catalog | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $catalogPath -Encoding UTF8
    Write-Host "Mapped weapon $ModelKey -> $runtimePath" -ForegroundColor Green
    Write-Warning "The model is staged but not yet visually fitted to the player hand. Review it in-game before release."
}
finally { $zip.Dispose() }
