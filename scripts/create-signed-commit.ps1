<#
.SYNOPSIS
    Creates a commit from the current working tree via the GitHub GraphQL
    createCommitOnBranch mutation.

.DESCRIPTION
    GitHub signs commits made through this mutation with its own key, so they show
    as Verified. This is the only way to produce signed commits under a GitHub App
    identity: a bot account has no GPG key, so `git commit -S` cannot be used.

    Changes are diffed against local HEAD, and the bot branch is re-pointed at that
    same commit before the new commit is created. The branch is therefore always
    exactly one commit ahead of the base and never accumulates unrelated drift.
    Anything previously committed to the bot branch, including manual edits, is
    replaced.

.PARAMETER Repo
    Target repository as "owner/name".

.PARAMETER Branch
    Bot branch to create, or to rebuild when it already exists (e.g. an open bot
    PR from a previous run).

.PARAMETER Message
    Commit message headline.

.PARAMETER PathSpec
    Git pathspecs to include. Defaults to the whole working tree.

.PARAMETER ExcludePath
    Path to leave untouched, even when it sits inside PathSpec. Used for content the
    target repository owns and this automation must not write back.

.ENVIRONMENT
    GH_TOKEN  Required. Token authorised to write to the target repository.

.OUTPUTS
    Exit code 0 when a commit was created, 3 when there was nothing to commit or the
    branch already carries this content.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]   $Repo,
    [Parameter(Mandatory = $true)] [string]   $Branch,
    [Parameter(Mandatory = $true)] [string]   $Message,
    [Parameter(Mandatory = $false)] [string[]] $PathSpec = @('.'),
    [Parameter(Mandatory = $false)] [string]   $ExcludePath
)

$ErrorActionPreference = 'Stop'

$paths = @($PathSpec)
if ($ExcludePath) { $paths += ":(exclude)$ExcludePath" }

$token = $env:GH_TOKEN
if ([string]::IsNullOrWhiteSpace($token)) { throw 'GH_TOKEN environment variable is empty' }

$headers = @{
    Authorization = "token $token"
    Accept        = 'application/vnd.github+json'
    'User-Agent'  = 'powerbi-visuals-localization'
}

git add -A -- $paths
if ($LASTEXITCODE -ne 0) { throw 'git add failed' }

$baseSha = (git rev-parse HEAD).Trim()

git diff --cached --quiet $baseSha -- $paths
if ($LASTEXITCODE -eq 0) {
    Write-Host "Nothing to commit for $($paths -join ', ')"
    exit 3
}
if ($LASTEXITCODE -ne 1) { throw 'git diff failed' }

$branchTip = $null
try {
    $existingRef = Invoke-RestMethod -Method Get -Headers $headers `
        -Uri "https://api.github.com/repos/$Repo/git/ref/heads/$Branch"
    $branchTip = $existingRef.object.sha
}
catch {
    if (-not ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 404)) {
        throw
    }
}

if ($branchTip) {
    git fetch --quiet origin "refs/heads/$Branch"
    if ($LASTEXITCODE -ne 0) { throw "git fetch failed for branch $Branch" }

    git diff --cached --quiet FETCH_HEAD -- $paths
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Branch $Branch already carries this content"
        exit 3
    }
    if ($LASTEXITCODE -ne 1) { throw 'git diff failed' }
}

# quotepath=false keeps non-ASCII paths readable instead of octal-escaped.
$statusLines = git -c core.quotepath=false diff --cached --name-status --no-renames $baseSha -- $PathSpec
if ($LASTEXITCODE -ne 0) { throw 'git diff --name-status failed' }

$additions = [System.Collections.Generic.List[object]]::new()
$deletions = [System.Collections.Generic.List[object]]::new()

foreach ($line in $statusLines) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $parts = $line -split "`t", 2
    if ($parts.Count -lt 2) { continue }
    $status = $parts[0].Trim()
    $path = $parts[1].Trim()

    if ($status -eq 'D') {
        $deletions.Add(@{ path = $path })
    }
    else {
        $bytes = [IO.File]::ReadAllBytes((Join-Path (Get-Location).Path $path))
        $additions.Add(@{ path = $path; contents = [Convert]::ToBase64String($bytes) })
    }
}

Write-Host "Committing $($additions.Count) additions and $($deletions.Count) deletions to $Repo"

if (-not $branchTip) {
    Invoke-RestMethod -Method Post -Headers $headers `
        -Uri "https://api.github.com/repos/$Repo/git/refs" `
        -Body (@{ ref = "refs/heads/$Branch"; sha = $baseSha } | ConvertTo-Json) `
        -ContentType 'application/json' | Out-Null
}
elseif ($branchTip -ne $baseSha) {
    Invoke-RestMethod -Method Patch -Headers $headers `
        -Uri "https://api.github.com/repos/$Repo/git/refs/heads/$Branch" `
        -Body (@{ sha = $baseSha; force = $true } | ConvertTo-Json) `
        -ContentType 'application/json' | Out-Null
    Write-Host "Re-pointed $Branch at $baseSha"
}

$body = @{
    query     = 'mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid url } } }'
    variables = @{
        input = @{
            branch          = @{ repositoryNameWithOwner = $Repo; branchName = $Branch }
            expectedHeadOid = $baseSha
            message         = @{ headline = $Message }
            fileChanges     = @{
                additions = @($additions.ToArray())
                deletions = @($deletions.ToArray())
            }
        }
    }
} | ConvertTo-Json -Depth 10 -Compress

$response = Invoke-RestMethod -Method Post -Headers $headers `
    -Uri 'https://api.github.com/graphql' -Body $body -ContentType 'application/json'

if ($response.errors) {
    throw "createCommitOnBranch failed: $($response.errors | ConvertTo-Json -Depth 5 -Compress)"
}

Write-Host "Created signed commit $($response.data.createCommitOnBranch.commit.url)"
