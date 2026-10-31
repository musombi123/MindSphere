[CmdletBinding()]
param(
    [string]$ArchiveName = "",
    [switch]$IncludeAnimationOnly,
    [string]$OutputCsv = "",
    [string]$OutputJson = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$assetsRoot = Join-Path $repoRoot "Assets"
if (!(Test-Path -LiteralPath $assetsRoot -PathType Container)) {
    throw "Assets directory not found: $assetsRoot"
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-LfsState([string]$Path) {
    $info = Get-Item -LiteralPath $Path
    if ($info.Length -gt 512) { return "Downloaded" }
    $prefix = Get-Content -LiteralPath $Path -Raw -ErrorAction SilentlyContinue
    if ($prefix -match "version https://git-lfs.github.com/spec/v1") { return "LFS POINTER - run targeted git lfs pull" }
    return "Small file - inspect"
}

function Get-ModelClass([string]$Name, [string]$Extension) {
    $base = [IO.Path]::GetFileNameWithoutExtension($Name)
    if ($base -match "(?i)(walk|run|idle|anim|animation|death|reload|shoot|jump|crouch|hit|pose|dodge|strafe)") {
        return "Animation clip"
    }
    if ($Extension -in @(".glb", ".gltf") -and $base -match "(?i)(weapon|rifle|gun|pistol|melee)") { return "Weapon candidate" }
    if ($Extension -in @(".glb", ".gltf") -and $base -match "(?i)(tree|acacia|eucalyptus|mango|fig|maize|banana|sugarcane|plant|crop)") { return "Vegetation candidate" }
    if ($Extension -in @(".glb", ".gltf") -and $base -match "(?i)(house|home|hut|building|shelter|fence|wall|shed)") { return "Building/prop candidate" }
    if ($Extension -in @(".glb", ".gltf") -and $base -match "(?i)(vehicle|car|truck|pickup|boda|bike|bus|motorcycle)") { return "Vehicle candidate" }
    if ($Extension -in @(".glb", ".gltf")) { return "3D model - inspect" }
    if ($Extension -eq ".fbx") { return "FBX - inspect rig/model" }
    if ($Extension -in @(".obj", ".blend")) { return "Needs conversion/import review" }
    return "Other"
}

$rows = [System.Collections.Generic.List[object]]::new()

Get-ChildItem -LiteralPath $assetsRoot -File | Where-Object {
    [IO.Path]::GetExtension($_.Name).ToLowerInvariant() -in @(".glb", ".gltf", ".fbx", ".obj", ".blend")
} | ForEach-Object {
    $ext = [IO.Path]::GetExtension($_.Name).ToLowerInvariant()
    $rows.Add([PSCustomObject]@{
        Source = "Standalone"
        Archive = ""
        Entry = $_.Name
        Type = Get-ModelClass $_.Name $ext
        Format = $ext
        SizeMB = [math]::Round($_.Length / 1MB, 2)
        Status = Get-LfsState $_.FullName
    })
}

$archives = Get-ChildItem -LiteralPath $assetsRoot -File -Filter "*.zip"
if ($ArchiveName) {
    $archives = @($archives | Where-Object { $_.Name -eq $ArchiveName })
    if (!$archives.Count) { throw "Archive '$ArchiveName' was not found in Assets/." }
}

foreach ($archive in $archives) {
    $state = Get-LfsState $archive.FullName
    if ($state -ne "Downloaded") {
        $rows.Add([PSCustomObject]@{
            Source = "Archive"
            Archive = $archive.Name
            Entry = ""
            Type = "Archive not readable"
            Format = ".zip"
            SizeMB = [math]::Round($archive.Length / 1MB, 2)
            Status = $state
        })
        continue
    }

    $zip = $null
    try {
        $zip = [System.IO.Compression.ZipFile]::OpenRead($archive.FullName)
        $modelEntries = @($zip.Entries | Where-Object {
            $_.Name -and [IO.Path]::GetExtension($_.Name).ToLowerInvariant() -in @(".glb", ".gltf", ".fbx", ".obj", ".blend")
        })
        if (!$IncludeAnimationOnly) {
            $modelEntries = @($modelEntries | Where-Object {
                (Get-ModelClass $_.Name ([IO.Path]::GetExtension($_.Name).ToLowerInvariant())) -ne "Animation clip"
            })
        }
        foreach ($entry in $modelEntries) {
            $ext = [IO.Path]::GetExtension($entry.Name).ToLowerInvariant()
            $rows.Add([PSCustomObject]@{
                Source = "ZIP member"
                Archive = $archive.Name
                Entry = $entry.FullName
                Type = Get-ModelClass $entry.Name $ext
                Format = $ext
                SizeMB = [math]::Round($entry.Length / 1MB, 2)
                Status = "Available in archive"
            })
        }
        if (!$modelEntries.Count) {
            $rows.Add([PSCustomObject]@{
                Source = "Archive"
                Archive = $archive.Name
                Entry = ""
                Type = "No GLB/GLTF/FBX/OBJ model members detected"
                Format = ".zip"
                SizeMB = [math]::Round($archive.Length / 1MB, 2)
                Status = "Inspected"
            })
        }
    }
    catch {
        $rows.Add([PSCustomObject]@{
            Source = "Archive"
            Archive = $archive.Name
            Entry = ""
            Type = "ZIP inspection failed"
            Format = ".zip"
            SizeMB = [math]::Round($archive.Length / 1MB, 2)
            Status = $_.Exception.Message
        })
    }
    finally {
        if ($zip) { $zip.Dispose() }
    }
}

if ($OutputCsv) {
    $csvPath = Join-Path $repoRoot $OutputCsv
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $csvPath) | Out-Null
    $rows | Export-Csv -LiteralPath $csvPath -NoTypeInformation -Encoding UTF8
    Write-Host "CSV report: $csvPath" -ForegroundColor Green
}
if ($OutputJson) {
    $jsonPath = Join-Path $repoRoot $OutputJson
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $jsonPath) | Out-Null
    $rows | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jsonPath -Encoding UTF8
    Write-Host "JSON report: $jsonPath" -ForegroundColor Green
}

Write-Host ""
Write-Host "PROJECT ZERO HOUR · SOURCE MODEL INVENTORY" -ForegroundColor Cyan
Write-Host "Assets root: $assetsRoot"
Write-Host "No files have been extracted or modified."
Write-Host ""
if (!$rows.Count) {
    Write-Warning "No standalone models or model entries were found."
    return
}
$rows | Sort-Object Source, Archive, Type, Entry | Format-Table Source, Archive, Entry, Type, Format, SizeMB, Status -AutoSize -Wrap
Write-Host ""
Write-Host "Standalone / archive candidates listed: $($rows.Count)" -ForegroundColor Green
Write-Host "GLB/GLTF entries are closest to the current browser runtime. FBX/OBJ entries need rig review or conversion."
