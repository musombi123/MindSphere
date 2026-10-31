[CmdletBinding()]
param(
    [string]$OutputDirectory = "tmp-model-candidates"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$assetsRoot = Join-Path $repoRoot "Assets"
$outputRoot = Join-Path $repoRoot $OutputDirectory
if (!(Test-Path -LiteralPath $assetsRoot -PathType Container)) { throw "Assets directory missing." }

if (Test-Path -LiteralPath $outputRoot) { Remove-Item -LiteralPath $outputRoot -Recurse -Force }
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

$records = [System.Collections.Generic.List[object]]::new()
$allowed = @(".glb", ".gltf", ".fbx", ".obj")
$standalone = Get-ChildItem -LiteralPath $assetsRoot -File | Where-Object {
    $allowed -contains $_.Extension.ToLowerInvariant()
}
foreach ($file in $standalone) {
    $targetDir = Join-Path $outputRoot "standalone"
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    $target = Join-Path $targetDir $file.Name
    Copy-Item -LiteralPath $file.FullName -Destination $target -Force
    $records.Add([PSCustomObject]@{
        Path = $target.Substring($repoRoot.Length).TrimStart([char]92,[char]47).Replace([char]92,'/')
        Source = "Standalone"
        Archive = ""
        Entry = $file.Name
        Extension = $file.Extension.ToLowerInvariant()
        SizeBytes = $file.Length
    })
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archives = Get-ChildItem -LiteralPath $assetsRoot -File -Filter "*.zip" | Where-Object {
    $_.Name -notmatch "(?i) - Copy\.zip$"
}
foreach ($archive in $archives) {
    $zip = $null
    try {
        $zip = [System.IO.Compression.ZipFile]::OpenRead($archive.FullName)
        foreach ($entry in $zip.Entries) {
            if (!$entry.Name) { continue }
            $ext = [IO.Path]::GetExtension($entry.Name).ToLowerInvariant()
            if ($allowed -notcontains $ext) { continue }

            # Keep all GLB/GLTF/OBJ model candidates. For FBX, retain the two
            # humanoid locomotion packs and obvious standalone/weapon model candidates only.
            $include = $ext -in @(".glb", ".gltf", ".obj")
            if ($ext -eq ".fbx") {
                $include = ($archive.Name -match "(?i)^Female Basic Locomotion Pack\.zip$|^Slim Shooter Pack\.zip$") -or
                    ($entry.Name -match "(?i)(trellis|soldier|character|weapon|rifle|model)" -and
                     $entry.Name -notmatch "(?i)(walk|run|idle|anim|death|reload|shoot|jump|crouch|hit|pose|strafe|turn|firing)")
            }
            if (!$include) { continue }

            $segments = @($entry.FullName -split '[\\/]')
            if ($segments -contains '..' -or [IO.Path]::IsPathRooted($entry.FullName)) { continue }
            $safeArchive = [IO.Path]::GetFileNameWithoutExtension($archive.Name)
            $relative = [IO.Path]::Combine([string[]]$segments)
            $destDir = Join-Path $outputRoot (Join-Path $safeArchive (Split-Path -Parent $relative))
            New-Item -ItemType Directory -Force -Path $destDir | Out-Null
            $dest = Join-Path $destDir ([IO.Path]::GetFileName($relative))
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $dest, $true)
            $records.Add([PSCustomObject]@{
                Path = $dest.Substring($repoRoot.Length).TrimStart([char]92,[char]47).Replace([char]92,'/')
                Source = "ZIP member"
                Archive = $archive.Name
                Entry = $entry.FullName
                Extension = $ext
                SizeBytes = $entry.Length
            })
        }
    }
    catch {
        Write-Warning "Could not extract candidates from $($archive.Name): $($_.Exception.Message)"
    }
    finally {
        if ($zip) { $zip.Dispose() }
    }
}

$manifest = Join-Path $repoRoot "artifacts\candidate-manifest.json"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $manifest) | Out-Null
$records | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifest -Encoding UTF8
Write-Host "Exported $($records.Count) model candidates to $outputRoot" -ForegroundColor Green
Write-Host "Candidate manifest: $manifest"
