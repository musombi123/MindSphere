[CmdletBinding()]
param(
    [string]$Archive = "german-bundeswehr-soldier-rigged.zip",
    [switch]$ListOnly
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$archivePath = Join-Path $repoRoot ("Assets\" + $Archive)
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
    $allowed = @(".fbx", ".glb", ".gltf", ".bin", ".obj", ".mtl", ".png", ".jpg", ".jpeg", ".tga", ".webp")
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

    $selected = $ranked[0].Entry
    $publicRoot = Join-Path $repoRoot "public"
    $extractRoot = Join-Path $publicRoot "assetscharactersimportedzero-soldier"
    New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null
    $extractRootFull = [IO.Path]::GetFullPath($extractRoot)
    $separator = [IO.Path]::DirectorySeparatorChar

    foreach ($entry in $entries) {
        $relative = $entry.FullName.Replace("/", $separator).Replace("\", $separator)
        if ([IO.Path]::IsPathRooted($relative) -or $relative -match "(^|[\/])\.\.([\/]|$)") {
            Write-Warning "Skipping unsafe archive path: $($entry.FullName)"
            continue
        }
        $destination = [IO.Path]::GetFullPath((Join-Path $extractRootFull $relative))
        if (!$destination.StartsWith($extractRootFull + $separator, [StringComparison]::OrdinalIgnoreCase)) {
            Write-Warning "Skipping archive path outside extraction root: $($entry.FullName)"
            continue
        }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination, $true)
    }

    $relativeModel = $selected.FullName.Replace("/", $separator).Replace("\", $separator)
    $selectedPath = Join-Path $extractRootFull $relativeModel
    if (!(Test-Path -LiteralPath $selectedPath -PathType Leaf)) {
        throw "Selected model was not extracted: $selectedPath"
    }
    $runtimePath = [IO.Path]::GetRelativePath($publicRoot, $selectedPath).Replace("\", "/")
    $catalog = [ordered]@{
        schemaVersion = 1
        character = @{
            playerModel = $runtimePath
            sourceArchive = $Archive
            selectionNote = "Selected by filename signals and uncompressed archive size. Confirm visual identity, rig, textures, scale, and licensing before public release."
        }
    }
    $catalogPath = Join-Path $publicRoot "assetsasset-catalog.json"
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $catalogPath) | Out-Null
    $catalog | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $catalogPath -Encoding UTF8

    Write-Host ""
    Write-Host "Player model staged:" -ForegroundColor Green
    Write-Host "  $runtimePath"
    Write-Host "Catalog written: $catalogPath"
    Write-Warning "The automatic model choice is a best candidate, not a visual approval. Open the game and inspect the rig, orientation, PBR textures, and weapon hand socket. Verify redistribution rights before shipping."
}
finally {
    $zip.Dispose()
}
