[CmdletBinding()]
param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$archiveRelative = "Assets/Female Basic Locomotion Pack.zip"
$archivePath = Join-Path $repoRoot "Assets/Female Basic Locomotion Pack.zip"
$archiveName = "Female Basic Locomotion Pack.zip"
$modelEntry = "trellis-2387720894.fbx"

function Invoke-Native {
    param([Parameter(Mandatory)][string]$Command, [Parameter(ValueFromRemainingArguments)][string[]]$Arguments)
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command failed with exit code $LASTEXITCODE. Arguments: $($Arguments -join ' ')"
    }
}

Push-Location $repoRoot
try {
    if (!(Test-Path -LiteralPath (Join-Path $repoRoot ".git"))) {
        throw "Run this script from a Git checkout of MindSphere."
    }

    # The branch switch can leave tracked LFS entries deleted in the working tree.
    # Restore only this required source archive, and only when it is absent.
    if (!(Test-Path -LiteralPath $archivePath -PathType Leaf)) {
        git ls-files --error-unmatch -- $archiveRelative *> $null
        if ($LASTEXITCODE -ne 0) {
            throw "$archiveRelative is not tracked on the current branch. Switch to the current Project Zero Hour branch and pull first."
        }
        Invoke-Native -Command "git" -Arguments @("restore", "--source=HEAD", "--", $archiveRelative)
    }

    Invoke-Native -Command "git" -Arguments @("lfs", "install")
    Invoke-Native -Command "git" -Arguments @("lfs", "pull", "--include=$archiveRelative")

    if (!(Test-Path -LiteralPath $archivePath -PathType Leaf)) {
        throw "Git LFS did not materialise $archivePath."
    }

    $archive = Get-Item -LiteralPath $archivePath
    if ($archive.Length -lt 512) {
        $firstLine = Get-Content -LiteralPath $archivePath -TotalCount 1 -ErrorAction SilentlyContinue
        if ($firstLine -match "version https://git-lfs.github.com/spec/v1") {
            throw "The archive is still an LFS pointer. Check Git LFS authentication and retry."
        }
        throw "The archive is unexpectedly small ($($archive.Length) bytes)."
    }

    Write-Host "Source archive ready: $($archive.Length) bytes" -ForegroundColor Green
    Write-Host "Importing inspected skinned humanoid candidate: $modelEntry" -ForegroundColor Cyan

    & (Join-Path $PSScriptRoot "prepare-character.ps1") -Archive $archiveName -ModelEntry $modelEntry
    if ($LASTEXITCODE -ne 0) {
        throw "prepare-character.ps1 failed."
    }

    if (!$SkipBuild) {
        Invoke-Native -Command "npm" -Arguments @("run", "build")
    }

    Write-Host ""
    Write-Host "Character candidate import stage completed." -ForegroundColor Green
    Write-Host "Review the rendered character, animation transitions, right-hand socket and source licence before treating this as production art."
    Write-Host "No files were committed or pushed automatically."
}
finally {
    Pop-Location
}
