[CmdletBinding()]
param(
    [string]$Archive = "",
    [string]$SourceFile = "",
    [string]$ModelEntry = "",
    [switch]$ListOnly
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
if ($SourceFile -and $Archive) {
    throw "Choose either -SourceFile or -Archive, not both."
}
if ($SourceFile) {
    $sourcePath = Join-Path $repoRoot $SourceFile
    if (!(Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "Source file not found: $sourcePath"
    }
    if ([IO.Path]::GetExtension($sourcePath).ToLowerInvariant() -ne ".glb") {
        throw "Standalone character imports must be self-contained .glb files. Use the ZIP pipeline for FBX plus texture dependencies."
    }
    $sourceInfo = Get-Item -LiteralPath $sourcePath
    if ($sourceInfo.Length -lt 512) {
        $sample = Get-Content -LiteralPath $sourcePath -Raw -ErrorAction SilentlyContinue
        if ($sample -match "version https://git-lfs.github.com/spec/v1") {
            throw "This is a Git LFS pointer, not the actual GLB. Run 'git lfs pull' first."
        }
        throw "Source GLB is unexpectedly small. Verify the asset."
    }

    $publicRoot = Join-Path $repoRoot "public"
    $extractRoot = Join-Path $publicRoot (Join-Path "assets" (Join-Path "characters" (Join-Path "imported" "zero-soldier")))
    New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null
    $targetFile = Join-Path $extractRoot ([IO.Path]::GetFileName($sourcePath))
    Copy-Item -LiteralPath $sourcePath -Destination $targetFile -Force
    $publicRootFull = [IO.Path]::GetFullPath($publicRoot).TrimEnd([char]92, [char]47)
    $runtimePath = $targetFile.Substring($publicRootFull.Length).TrimStart([char]92, [char]47).Replace([char]92, '/')

    $catalogPath = Join-Path (Join-Path $publicRoot "assets") "asset-catalog.json"
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $catalogPath) | Out-Null
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
    $catalog | Add-Member -NotePropertyName character -NotePropertyValue ([PSCustomObject]@{
        playerModel = $runtimePath
        sourceFile = $SourceFile
        selectionNote = "Imported as a standalone GLB. The runtime will reject it if it lacks a usable skinned humanoid mesh. Confirm likeness, materials, rig, scale, weapon socket and redistribution rights."
    }) -Force
    $catalog | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath $catalogPath -Encoding UTF8

    Write-Host "Player GLB staged: $runtimePath" -ForegroundColor Green
    Write-Host "Catalog written: $catalogPath"
    Write-Warning "A GLB file is not automatically a rigged humanoid. The runtime validates for a skin/armature and will keep the development proxy if one is absent."
    return
}

if (!$Archive) { $Archive = "german-bundeswehr-soldier-rigged.zip" }
$archivePath = Join-Path $repoRoot (Join-Path "Assets" $Archive)
if (!(Test-Path -LiteralPath $archivePath -PathType Leaf)) {
    throw "Archive not found: $archivePath. Run 'git lfs pull' from the repository root and retry."
}

$archiveInfo = Get-Item -LiteralPath $archivePath
if ($archiveInfo.Length -lt 512) {
    $sample = Get-Content -LiteralPath $archivePath -Raw -ErrorAction SilentlyContinue
    if ($sample -match "version https://git-lfs.github.com/spec/v1") {
        throw "This is a Git LFS pointer, not the actual archive. Run 'git lfs pull' first."
    }
    throw "The archive is unexpectedly small ($($archiveInfo.Length) bytes). Verify the downloaded asset."
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    $allowed = @(".fbx", ".glb", ".gltf", ".bin", ".obj", ".mtl", ".png", ".jpg", ".jpeg", ".tga", ".webp", ".ktx2", ".json", ".txt", ".md", ".pdf")
    $entries = @($zip.Entries | Where-Object {
        $_.Name -and $allowed -contains [IO.Path]::GetExtension($_.Name).ToLowerInvariant()
    })
    $models = @($entries | Where-Object {
        $ext = [IO.Path]::GetExtension($_.Name).ToLowerInvariant()
        $name = [IO.Path]::GetFileNameWithoutExtension($_.Name)
        ($ext -in @(".fbx", ".glb", ".gltf", ".obj")) -and
        ($name -notmatch "(?i)(walk|run|idle|anim|animation|death|reload|shoot|jump|crouch|hit|pose)")
    })

    if (!$models.Count) {
        Write-Host "Model-like files found in $Archive :" -ForegroundColor Yellow
        $entries | Where-Object { [IO.Path]::GetExtension($_.Name).ToLowerInvariant() -in @(".fbx", ".glb", ".gltf", ".obj") } |
            Select-Object -ExpandProperty FullName
        throw "No obvious character mesh was found. Inspect the archive contents; do not select an animation-only FBX as the player."
    }

    $ranked = @($models | ForEach-Object {
        $name = [IO.Path]::GetFileNameWithoutExtension($_.Name)
        $score = 0
        if ($name -match "(?i)soldier|character|player|human|body") { $score += 10 }
        if ($name -match "(?i)rigged|armature|skeleton") { $score += 8 }
        [PSCustomObject]@{ Entry = $_; Score = $score; Size = $_.Length; Name = $_.FullName }
    } | Sort-Object Score, Size -Descending)

    Write-Host ""
    Write-Host "Character model candidates (ranked by filename signal and uncompressed size):" -ForegroundColor Cyan
    $ranked | Select-Object Score, @{Name="SizeMB";Expression={[math]::Round($_.Size / 1MB, 2)}}, Name | Format-Table -AutoSize
    if ($ListOnly) { return }

    $selected = $null
    if ($ModelEntry) {
        $selected = $models | Where-Object { $_.FullName -eq $ModelEntry } | Select-Object -First 1
        if (!$selected) {
            throw "ModelEntry '$ModelEntry' was not found in archive '$Archive'. Copy the exact path from -ListOnly output."
        }
    } else {
        $selected = $ranked[0].Entry
        if ($ranked.Count -gt 1) {
            Write-Warning "Multiple model candidates exist. The script selected the top-ranked candidate; inspect and override with -ModelEntry if it is not the intended player."
        }
    }

    $publicRoot = Join-Path $repoRoot "public"
    $extractRoot = Join-Path $publicRoot (Join-Path "assets" (Join-Path "characters" (Join-Path "imported" "zero-soldier")))
    New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null
    $extractRootFull = [IO.Path]::GetFullPath($extractRoot)
    $separator = [IO.Path]::DirectorySeparatorChar
    $extractPrefix = $extractRootFull.TrimEnd([char]92, [char]47) + $separator

    foreach ($entry in $entries) {
        $segments = @($entry.FullName -split '[\\/]')
        if ([IO.Path]::IsPathRooted($entry.FullName) -or $segments -contains '..') {
            Write-Warning "Skipping unsafe archive path: $($entry.FullName)"
            continue
        }
        $relative = [IO.Path]::Combine([string[]]$segments)
        $destination = [IO.Path]::GetFullPath((Join-Path $extractRootFull $relative))
        if (!$destination.StartsWith($extractPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            Write-Warning "Skipping archive path outside extraction root: $($entry.FullName)"
            continue
        }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination, $true)
    }

    $selectedSegments = @($selected.FullName -split '[\\/]')
    $selectedPath = Join-Path $extractRootFull ([IO.Path]::Combine([string[]]$selectedSegments))
    if (!(Test-Path -LiteralPath $selectedPath -PathType Leaf)) {
        throw "Selected model was not extracted: $selectedPath"
    }
    $publicRootFull = [IO.Path]::GetFullPath($publicRoot).TrimEnd([char]92, [char]47)
    $runtimePath = $selectedPath.Substring($publicRootFull.Length).TrimStart([char]92, [char]47).Replace([char]92, '/')

    $catalogPath = Join-Path (Join-Path $publicRoot "assets") "asset-catalog.json"
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $catalogPath) | Out-Null
    $catalog = $null
    if (Test-Path -LiteralPath $catalogPath -PathType Leaf) {
        try { $catalog = Get-Content -LiteralPath $catalogPath -Raw | ConvertFrom-Json }
        catch { Write-Warning "Existing asset catalog could not be parsed; creating a fresh catalog." }
    }
    if ($null -eq $catalog) { $catalog = [PSCustomObject]@{} }
    if ($null -eq $catalog.worldModels) {
        $catalog | Add-Member -NotePropertyName worldModels -NotePropertyValue ([PSCustomObject]@{}) -Force
    }
    $catalog | Add-Member -NotePropertyName schemaVersion -NotePropertyValue 1 -Force
    $catalog | Add-Member -NotePropertyName character -NotePropertyValue ([PSCustomObject]@{
        playerModel = $runtimePath
        sourceArchive = $Archive
        selectedArchiveEntry = $selected.FullName
        selectionNote = "Selected by filename signals and uncompressed archive size. Confirm visual identity, rig, textures, scale, and licensing before public release."
    }) -Force
    $catalog | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath $catalogPath -Encoding UTF8

    Write-Host ""
    Write-Host "Player model staged:" -ForegroundColor Green
    Write-Host "  $runtimePath"
    Write-Host "Catalog written: $catalogPath"
    Write-Warning "The automatic model choice is a best candidate, not a visual approval. Open the game and inspect the rig, orientation, PBR textures, and weapon hand socket. Verify redistribution rights before shipping."
}
finally {
    $zip.Dispose()
}
