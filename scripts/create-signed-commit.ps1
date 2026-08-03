<#
.SYNOPSIS
    Creates a commit from the current working tree via the GitHub GraphQL
    createCommitOnBranch mutation.

.DESCRIPTION
    GitHub signs commits made through this mutation with its own key, so they show
    as Verified. This is the only way to produce signed commits under a GitHub App
    identity: a bot account has no GPG key, so `git commit -S` cannot be used.

    Changes are diffed against local HEAD and that same commit is used as the parent,
    so a base branch moving during the run cannot silently drop someone else's work.

.PARAMETER Repo
    Target repository as "owner/name".

.PARAMETER Branch
    Branch to create. Must not already exist.

.PARAMETER Message
    Commit message headline.

.PARAMETER PathSpec
    Git pathspecs to include. Defaults to the whole working tree.

.ENVIRONMENT
    GH_TOKEN  Required. Token authorised to write to the target repository.

.OUTPUTS
    Exit code 0 when a commit was created, 3 when there was nothing to commit.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]   $Repo,
    [Parameter(Mandatory = $true)] [string]   $Branch,
    [Parameter(Mandatory = $true)] [string]   $Message,
    [Parameter(Mandatory = $false)] [string[]] $PathSpec = @('.')
)

$ErrorActionPreference = 'Stop'

$token = $env:GH_TOKEN
if ([string]::IsNullOrWhiteSpace($token)) { throw 'GH_TOKEN environment variable is empty' }

git add -A -- $PathSpec
if ($LASTEXITCODE -ne 0) { throw 'git add failed' }

git diff --cached --quiet -- $PathSpec
if ($LASTEXITCODE -eq 0) {
    Write-Host "Nothing to commit for $($PathSpec -join ', ')"
    exit 3
}

$baseSha = (git rev-parse HEAD).Trim()

# quotepath=false keeps non-ASCII paths readable instead of octal-escaped.
$statusLines = git -c core.quotepath=false diff --cached --name-status --no-renames HEAD -- $PathSpec

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

$headers = @{
    Authorization = "token $token"
    Accept        = 'application/vnd.github+json'
    'User-Agent'  = 'powerbi-visuals-localization'
}

Invoke-RestMethod -Method Post -Headers $headers `
    -Uri "https://api.github.com/repos/$Repo/git/refs" `
    -Body (@{ ref = "refs/heads/$Branch"; sha = $baseSha } | ConvertTo-Json) `
    -ContentType 'application/json' | Out-Null

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
