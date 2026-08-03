<#
.SYNOPSIS
    Mints a short-lived GitHub App installation access token and publishes it
    as a secret Azure DevOps pipeline variable (default name: GITHUB_APP_TOKEN).

.DESCRIPTION
    Signs a JWT (RS256) with the App's private key, resolves the installation
    id for the target repository, then calls
    POST /app/installations/{id}/access_tokens to obtain a token valid for
    ~1 hour. The token is registered via `##vso[task.setvariable ...]` so it
    is masked in logs and available to subsequent tasks in the same job.

    Requires PowerShell 7+ (System.Security.Cryptography.RSA.ImportFromPem).

.PARAMETER AppId
    The GitHub App ID (numeric string).

.PARAMETER RepoOwner
    Owner (org or user) of the target repository.

.PARAMETER RepoName
    Name of the target repository. Used only to look up the installation id;
    the resulting token grants access to every repo the installation covers.

.PARAMETER OutputVariableName
    Pipeline variable name to publish. Defaults to GITHUB_APP_TOKEN.

.ENVIRONMENT
    GITHUB_APP_PRIVATE_KEY  Required. PEM-encoded RSA private key contents.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string] $AppId,
    [Parameter(Mandatory = $true)] [string] $RepoOwner,
    [Parameter(Mandatory = $true)] [string] $RepoName,
    [Parameter(Mandatory = $false)] [string] $OutputVariableName = 'GITHUB_APP_TOKEN'
)

$ErrorActionPreference = 'Stop'

$pemKey = $env:GITHUB_APP_PRIVATE_KEY
if ([string]::IsNullOrWhiteSpace($AppId))  { throw 'AppId is empty' }
if ([string]::IsNullOrWhiteSpace($pemKey)) { throw 'GITHUB_APP_PRIVATE_KEY environment variable is empty' }

# Defensive normalization: if the PEM was stored/pasted with newlines collapsed
# into spaces (a common Key Vault copy-paste accident), rebuild a well-formed
# PEM before handing it to RSA::ImportFromPem.
if ($pemKey -notmatch "(?m)^-----BEGIN [A-Z ]+PRIVATE KEY-----`n") {
    $match = [regex]::Match(
        $pemKey,
        '-----BEGIN (?<label>[A-Z ]+PRIVATE KEY)-----(?<body>.*?)-----END \k<label>-----',
        [System.Text.RegularExpressions.RegexOptions]::Singleline)
    if ($match.Success) {
        $label = $match.Groups['label'].Value
        # Strip everything that isn't valid base64 (spaces, tabs, CRs, LFs).
        $body  = ($match.Groups['body'].Value -replace '[^A-Za-z0-9+/=]', '')
        # Re-wrap the base64 body at 64 chars per RFC 7468.
        $sb = [System.Text.StringBuilder]::new()
        for ($i = 0; $i -lt $body.Length; $i += 64) {
            $len = [Math]::Min(64, $body.Length - $i)
            [void]$sb.AppendLine($body.Substring($i, $len))
        }
        $pemKey = "-----BEGIN $label-----`n$($sb.ToString())-----END $label-----`n"
        Write-Host 'Reformatted single-line PEM key into standard multi-line format.'
    }
}

function ConvertTo-Base64Url([byte[]]$bytes) {
    [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

# --- Build the JWT (RS256) -----------------------------------------------
$now     = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$header  = '{"alg":"RS256","typ":"JWT"}'
$payload = @{ iat = $now - 60; exp = $now + 540; iss = $AppId } | ConvertTo-Json -Compress

$headerB64    = ConvertTo-Base64Url ([Text.Encoding]::UTF8.GetBytes($header))
$payloadB64   = ConvertTo-Base64Url ([Text.Encoding]::UTF8.GetBytes($payload))
$signingInput = "$headerB64.$payloadB64"

$rsa = [System.Security.Cryptography.RSA]::Create()
try {
    $rsa.ImportFromPem($pemKey)
} catch {
    throw "Failed to import GITHUB_APP_PRIVATE_KEY as PEM: $($_.Exception.Message)"
}

$sigBytes = $rsa.SignData(
    [Text.Encoding]::UTF8.GetBytes($signingInput),
    [System.Security.Cryptography.HashAlgorithmName]::SHA256,
    [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)

$jwt = "$signingInput.$(ConvertTo-Base64Url $sigBytes)"

# --- Exchange the JWT for an installation access token -------------------
$apiHeaders = @{
    Authorization = "Bearer $jwt"
    Accept        = 'application/vnd.github+json'
    'User-Agent'  = 'powerbi-visuals-localization'
}

$installation = Invoke-RestMethod -Method Get -Headers $apiHeaders `
    -Uri "https://api.github.com/repos/$RepoOwner/$RepoName/installation"

$tokenResp = Invoke-RestMethod -Method Post -Headers $apiHeaders `
    -Uri "https://api.github.com/app/installations/$($installation.id)/access_tokens"
  
# --- Publish as a masked pipeline variable -------------------------------
Write-Host "##vso[task.setvariable variable=$OutputVariableName;isSecret=true;issecret=true]$($tokenResp.token)"
Write-Host "GitHub App installation token minted for $RepoOwner/$RepoName (expires $($tokenResp.expires_at))"

