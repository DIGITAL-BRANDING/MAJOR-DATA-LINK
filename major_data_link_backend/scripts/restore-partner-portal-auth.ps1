$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env.local'
$pgBin = 'C:\Program Files\PostgreSQL\17\bin'
$cutoffText = '2026-10-29 13:24:04.165008'
foreach ($tool in @('psql.exe')) {
  if (-not (Test-Path -LiteralPath (Join-Path $pgBin $tool))) { throw "Required PostgreSQL client tool is missing: $tool" }
}
if (-not (Test-Path -LiteralPath $envFile)) { throw 'The local .env.local file is missing.' }

$settings = @{}
Get-Content -LiteralPath $envFile | ForEach-Object {
  if ($_ -match '^\s*(SOURCE_DATABASE_URL|TARGET_DATABASE_URL)\s*=\s*(.*)$') {
    $settings[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
  }
}

function Get-ProjectConnection([string]$key, [string]$projectRef) {
  if (-not $settings[$key]) { throw "$key is missing from .env.local." }
  $uri = [Uri]$settings[$key]
  $parts = $uri.UserInfo.Split(':', 2)
  if ($parts.Count -ne 2) { throw "$key must contain a username and password." }
  $username = [Uri]::UnescapeDataString($parts[0])
  if ($uri.Port -ne 5432 -or -not $uri.Host.EndsWith('.pooler.supabase.com', [StringComparison]::OrdinalIgnoreCase) -or $username -ne "postgres.$projectRef") {
    throw "$key must be the expected project's Session pooler URL on port 5432."
  }
  return [pscustomobject]@{
    Uri = $uri
    User = $username
    Password = [Uri]::UnescapeDataString($parts[1])
    Database = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
  }
}

function Invoke-Psql([pscustomobject]$connection, [string[]]$arguments, [string]$label) {
  $env:PGPASSWORD = $connection.Password
  $oldPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & (Join-Path $pgBin 'psql.exe') @arguments 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $oldPreference
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  }
  if ($exitCode -ne 0) {
    $details = (@($output) | ForEach-Object { [string]$_ }) -join ' '
    throw "$label failed: $details"
  }
  return ((@($output) | ForEach-Object { [string]$_ }) -join "`n").Trim()
}

function Invoke-PsqlFile([pscustomobject]$connection, [string]$sql, [string]$sqlFile, [string]$label) {
  [System.IO.File]::WriteAllText($sqlFile, $sql, [System.Text.Encoding]::ASCII)
  return Invoke-Psql $connection @('-X', '-A', '-t', '-F', '|', '-v', 'ON_ERROR_STOP=1', '-h', $connection.Uri.Host, '-p', [string]$connection.Uri.Port, '-U', $connection.User, '-d', $connection.Database, '-f', $sqlFile) $label
}

$source = Get-ProjectConnection 'SOURCE_DATABASE_URL' 'xdmtkgiemcsllswlqhbc'
$target = Get-ProjectConnection 'TARGET_DATABASE_URL' 'ctmtzrjyaddmfelxqvzc'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$csvFile = Join-Path $projectRoot "partner-portal-auth-$stamp.csv"
$exportSql = Join-Path $projectRoot "partner-portal-auth-export-$stamp.sql"
$importSql = Join-Path $projectRoot "partner-portal-auth-import-$stamp.sql"
$verifySql = Join-Path $projectRoot "partner-portal-auth-verify-$stamp.sql"
$csvPathSql = $csvFile.Replace('\', '/').Replace("'", "''")

try {
  $scope = @'
EXISTS (SELECT 1 FROM public."PartnerTransaction" t WHERE t."partnerId"=p.id AND t."createdAt" >= TIMESTAMP '__CUTOFF__')
'@.Replace('__CUTOFF__', $cutoffText)

  $scope = $scope.Replace('__CUTOFF__', $cutoffText)

  $sourcePreflightSql = @'
SELECT count(*)::text || '|' || count(*) FILTER (WHERE p."passwordHash" IS NOT NULL)::text
FROM public."Partner" p WHERE __SCOPE__;
'@
  $sourcePreflightSql = $sourcePreflightSql.Replace('__SCOPE__', $scope)
  $sourcePreflight = Invoke-PsqlFile $source $sourcePreflightSql $verifySql 'Source portal credential preflight'
  $sourceParts = $sourcePreflight.Split('|')
  if ($sourceParts.Count -ne 2 -or [Int64]$sourceParts[0] -ne [Int64]$sourceParts[1] -or [Int64]$sourceParts[0] -eq 0) {
    throw 'Source partner portal credentials are missing or incomplete; no credentials were copied.'
  }
  $credentialCount = [Int64]$sourceParts[1]

  $targetPreflightSql = $sourcePreflightSql
  $targetPreflight = Invoke-PsqlFile $target $targetPreflightSql $verifySql 'Target portal credential preflight'
  $targetParts = $targetPreflight.Split('|')
  if ($targetParts.Count -ne 2 -or [Int64]$targetParts[0] -ne $credentialCount -or [Int64]$targetParts[1] -ne 0) {
    throw 'Target partner scope is not in the expected empty-auth state; no credential update was started.'
  }

  $exportCommand = '\copy (SELECT p.id, p."passwordHash", p."passwordFailures", p."passwordFailureAt", p."passwordLockedUntil" FROM public."Partner" p WHERE p."passwordHash" IS NOT NULL AND {0} ORDER BY p.id) TO ''{1}'' WITH (FORMAT csv, HEADER true)' -f $scope, $csvPathSql
  Set-Content -LiteralPath $exportSql -Value $exportCommand -Encoding ASCII
  $exportOutput = Invoke-Psql $source @('-X', '-v', 'ON_ERROR_STOP=1', '-h', $source.Uri.Host, '-p', [string]$source.Uri.Port, '-U', $source.User, '-d', $source.Database, '-f', $exportSql) 'Portal credential export'
  $exportMatch = [regex]::Match($exportOutput, '\bCOPY\s+(\d+)\b')
  if (-not $exportMatch.Success -or [Int64]$exportMatch.Groups[1].Value -ne $credentialCount) { throw 'Exported portal credential count did not match preflight.' }

  $importSqlText = @"
CREATE TEMP TABLE partner_auth_stage (
  id text PRIMARY KEY,
  "passwordHash" text NOT NULL,
  "passwordFailures" integer NOT NULL,
  "passwordFailureAt" timestamp(3),
  "passwordLockedUntil" timestamp(3)
);
BEGIN;
\copy partner_auth_stage (id, "passwordHash", "passwordFailures", "passwordFailureAt", "passwordLockedUntil") FROM '$csvPathSql' WITH (FORMAT csv, HEADER true)
UPDATE public."Partner" AS target
SET "passwordHash"=stage."passwordHash",
    "passwordFailures"=stage."passwordFailures",
    "passwordFailureAt"=stage."passwordFailureAt",
    "passwordLockedUntil"=stage."passwordLockedUntil"
FROM partner_auth_stage AS stage
WHERE target.id=stage.id AND target."passwordHash" IS NULL;
COMMIT;
"@
  [System.IO.File]::WriteAllText($importSql, $importSqlText, [System.Text.Encoding]::ASCII)
  $importOutput = Invoke-Psql $target @('-X', '-v', 'ON_ERROR_STOP=1', '-h', $target.Uri.Host, '-p', [string]$target.Uri.Port, '-U', $target.User, '-d', $target.Database, '-f', $importSql) 'Portal credential import'
  $updatedMatch = [regex]::Match($importOutput, '\bUPDATE\s+(\d+)\b')
  if (-not $updatedMatch.Success -or [Int64]$updatedMatch.Groups[1].Value -ne $credentialCount) { throw 'Updated portal credential count did not match source.' }

  $fingerprintSql = @'
SELECT count(*)::text || '|' || coalesce(sum(hashtextextended(id || ':' || "passwordHash" || ':' || "passwordFailures" || ':' || coalesce("passwordFailureAt"::text,'') || ':' || coalesce("passwordLockedUntil"::text,''),0)::numeric),0)::text
FROM public."Partner" p WHERE __SCOPE__ AND p."passwordHash" IS NOT NULL;
'@
  $fingerprintSql = $fingerprintSql.Replace('__SCOPE__', $scope)
  $sourceFingerprint = Invoke-PsqlFile $source $fingerprintSql $verifySql 'Source portal credential verification'
  $targetFingerprint = Invoke-PsqlFile $target $fingerprintSql $verifySql 'Target portal credential verification'
  if ($sourceFingerprint -ne $targetFingerprint) { throw 'Partner portal credential verification did not match the source.' }
  Write-Output "Partner portal credential hashes restored and verified for $credentialCount partner accounts. Passwords were not printed or changed."
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  foreach ($temporaryFile in @($csvFile, $exportSql, $importSql, $verifySql)) {
    if ($temporaryFile -and (Test-Path -LiteralPath $temporaryFile)) { Remove-Item -LiteralPath $temporaryFile -Force -ErrorAction SilentlyContinue }
  }
  $source.Password = $null
  $target.Password = $null
  $settings['SOURCE_DATABASE_URL'] = $null
  $settings['TARGET_DATABASE_URL'] = $null
}
