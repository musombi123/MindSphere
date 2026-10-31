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
$validKeys = @(
    "acacia", "eucalyptus", "mangoTree", "figTree", "mudHouse", "timberFence",
    "bodaBoda", "rustedPickup", "waterTank", "bridge", "bananaPlant",
    "maizePatch", "sugarcanePatch", "crates", "tyres", "firePit", "stoneWall"
)

if ($Archive -and $SourceFile) {
    throw "Choose either -Archive or -SourceFile, not both."
}
if (!$Archive -and !$SourceFile) {
    throw "Supply -Archive (a ZIP in Assets/) or -SourceFile (a GLB in Assets/)."
}
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
if ($null -eq $catalog.worldModels) {
    $catalog | Add-Member -NotePropertyName worldModels -NotePropertyValue ([PSCustomObject]@{}) -Force
}
$catalog | Add-Member -NotePropertyName schemaVersion -NotePropertyValue 1 -Force

$extractRoot = Join-Path (Join-Path (Join-Path $publicRoot "assets") "world") "imported"
New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null
$extractRootFull = [IO.Path]::GetFullPath($extractRoot)
$separator = [IO.Path]::DirectorySeparatorChar
$extractPrefix = $extractRootFull.TrimEnd([char]92, [char]47) + $separator

if ($SourceFile) {
    if (!$ModelKey) { throw "-ModelKey is required when importing a standalone GLB." }
    $sourcePath = Join-Path $repoRoot $SourceFile
    if (!(Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "Source file not found: $sourcePath"
    }
    if ([IO.Path]::GetExtension($sourcePath).ToLowerInvariant() -ne ".glb") {
        throw "Standalone imports must be self-contained .glb files. Use an archive for .gltf plus external dependencies."
    }
    $sourceInfo = Get-Item -LiteralPath $sourcePath
    if ($sourceInfo.Length -lt 512) {
        throw "Source file is unexpectedly small. Check whether Git LFS downloaded the actual GLB."
    }
    $safeKey = $ModelKey -replace '[^A-Za-z0-9_-]', '-'
    $targetDir = Join-Path $extractRoot $safeKey
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    $targetFile = Join-Path $targetDir ([IO.Path]::GetFileName($sourcePath))
    Copy-Item -LiteralPath $sourcePath -Destination $targetFile -Force
    $publicRootFull = [IO.Path]::GetFullPath($publicRoot).TrimEnd([char]92, [char]47)
    $runtimePath = $targetFile.Substring($publicRootFull.Length).TrimStart([char]92, [char]47).Replace([char]92, '/')
    $catalog.worldModels | Add-Member -NotePropertyName $ModelKey -NotePropertyValue ([PSCustomObject]@{
        file = $runtimePath
        sourceFile = $SourceFile
        selectionNote = "Imported as a self-contained GLB. Review scale, orientation, mesh quality, PBR materials, collision suitability and license before release."
    }) -Force
    $catalog | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $catalogPath -Encoding UTF8
    Write-Host "Mapped $ModelKey -> $runtimePath" -ForegroundColor Green
    Write-Warning "The file has been staged, not visually approved. Test in the game and verify its license."
    return
}

$archivePath = Join-Path (Join-Path $repoRoot "Assets") $Archive
if (!(Test-Path -LiteralPath $archivePath -PathType Leaf)) {
    throw "Archive not found: $archivePath. Run 'git lfs pull' first."
}
$archiveInfo = Get-Item -LiteralPath $archivePath
if ($archiveInfo.Length -lt 512) {
    $sample = Get-Content -LiteralPath $archivePath -Raw -ErrorAction SilentlyContinue
    if ($sample -match "version https://git-lfs.github.com/spec/v1") {
        throw "This is a Git LFS pointer, not the actual archive. Run 'git lfs pull' first."
    }
    throw "Archive is unexpectedly small. Verify the LFS download."
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    $allowed = @(".glb", ".gltf", ".bin", ".png", ".jpg", ".jpeg", ".tga", ".webp", ".ktx2", ".exr", ".hdr", ".json", ".mtl", ".obj", ".fbx", ".txt", ".md", ".pdf")
    $entries = @($zip.Entries | Where-Object {
        $_.Name -and $allowed -contains [IO.Path]::GetExtension($_.Name).ToLowerInvariant()
    })
    $models = @($entries | Where-Object {
        [IO.Path]::GetExtension($_.Name).ToLowerInvariant() -in @(".glb", ".gltf")
    })

    Write-Host ""
    Write-Host "Archive: $Archive" -ForegroundColor Cyan
    Write-Host "Model files supported by the browser runtime (.glb/.gltf): $($models.Count)"
    $models | Select-Object FullName, @{Name="SizeMB";Expression={[math]::Round($_.Length / 1MB, 2)}} | Format-Table -AutoSize
    if ($ListOnly -or !$ModelKey) {
        Write-Host "Use -ModelKey and optionally -ModelEntry to map one verified model into the game catalog."
        return
    }

    $selected = $null
    if ($ModelEntry) {
        $selected = $models | Where-Object { $_.FullName -eq $ModelEntry } | Select-Object -First 1
        if (!$selected) {
            throw "ModelEntry '$ModelEntry' is not a .glb/.gltf model in this archive. Copy its exact path from -ListOnly output."
        }
    } elseif ($models.Count -eq 1) {
        $selected = $models[0]
    } else {
        throw "This archive contains multiple GLB/GLTF files. Run -ListOnly and pass the exact internal path with -ModelEntry."
    }

    $safeKey = $ModelKey -replace '[^A-Za-z0-9_-]', '-'
    $targetRoot = Join-Path $extractRoot $safeKey
    New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null
    $targetRootFull = [IO.Path]::GetFullPath($targetRoot)
    $targetPrefix = $targetRootFull.TrimEnd([char]92, [char]47) + $separator

    foreach ($entry in $entries) {
        $segments = @($entry.FullName -split '[\\/]')
        if ([IO.Path]::IsPathRooted($entry.FullName) -or $segments -contains '..') {
            Write-Warning "Skipping unsafe archive path: $($entry.FullName)"
            continue
        }
        $relative = [IO.Path]::Combine([string[]]$segments)
        $destination = [IO.Path]::GetFullPath((Join-Path $targetRootFull $relative))
        if (!$destination.StartsWith($targetPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            Write-Warning "Skipping archive path outside extraction root: $($entry.FullName)"
            continue
        }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination, $true)
    }

    $selectedSegments = @($selected.FullName -split '[\\/]')
    $selectedPath = Join-Path $targetRootFull ([IO.Path]::Combine([string[]]$selectedSegments))
    if (!(Test-Path -LiteralPath $selectedPath -PathType Leaf)) {
        throw "Selected model was not extracted: $selectedPath"
    }
    $publicRootFull = [IO.Path]::GetFullPath($publicRoot).TrimEnd([char]92, [char]47)
    $runtimePath = $selectedPath.Substring($publicRootFull.Length).TrimStart([char]92, [char]47).Replace([char]92, '/')
    $catalog.worldModels | Add-Member -NotePropertyName $ModelKey -NotePropertyValue ([PSCustomObject]@{
        file = $runtimePath
        sourceArchive = $Archive
        archiveEntry = $selected.FullName
        selectionNote = "Extracted from the source archive. Review scale, orientation, mesh quality, PBR materials, collision suitability and license before release."
    }) -Force
    $catalog | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $catalogPath -Encoding UTF8
    Write-Host ""
    Write-Host "Mapped $ModelKey -> $runtimePath" -ForegroundColor Green
    Write-Host "Catalog written: $catalogPath"
    Write-Warning "The selected model is not visually approved. Check the rendered result and verify its license before public release."
}
finally {
    $zip.Dispose()
}
