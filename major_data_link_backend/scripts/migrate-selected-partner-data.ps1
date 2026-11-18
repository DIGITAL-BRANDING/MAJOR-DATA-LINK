$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env.local'
$backupFile = 'D:\MajorDataLinkBackups\major-data-link-public-20261118-133352.dump'
$backupDirectory = 'D:\MajorDataLinkBackups'
$pgBin = 'C:\Program Files\PostgreSQL\17\bin'
$cutoffText = '2026-10-29 13:24:04.165008'
$cutoff = "TIMESTAMP '$cutoffText'"

foreach ($tool in @('psql.exe', 'pg_restore.exe')) {
  if (-not (Test-Path -LiteralPath (Join-Path $pgBin $tool))) { throw "Required PostgreSQL client tool is missing: $tool" }
}
if (-not (Test-Path -LiteralPath $backupFile)) { throw 'The validated full backup is missing.' }
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

function Invoke-PgRestore([pscustomobject]$connection, [string[]]$arguments, [string]$label) {
  $env:PGPASSWORD = $connection.Password
  $oldPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & (Join-Path $pgBin 'pg_restore.exe') @arguments 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $oldPreference
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  }
  if ($exitCode -ne 0) {
    $details = (@($output) | ForEach-Object { [string]$_ }) -join ' '
    throw "$label failed: $details"
  }
}

$source = Get-ProjectConnection 'SOURCE_DATABASE_URL' 'xdmtkgiemcsllswlqhbc'
$target = Get-ProjectConnection 'TARGET_DATABASE_URL' 'ctmtzrjyaddmfelxqvzc'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$partnerCsvFile = Join-Path $backupDirectory "selected-partners-$stamp.csv"
$csvFile = Join-Path $backupDirectory "partner-transactions-$stamp.csv"
$copyOutSql = Join-Path $backupDirectory "partner-copy-out-$stamp.sql"
$copyInSql = Join-Path $backupDirectory "partner-copy-in-$stamp.sql"
$queryFile = Join-Path $backupDirectory "partner-query-$stamp.sql"

try {
  # Only copy parent partner rows referenced by the selected transactions. Keep
  # business identity and current wallet state, while excluding login hashes,
  # webhook secrets, BVN data, and API credentials.
  $partnerStateSql = @'
WITH selected AS (
  SELECT DISTINCT p.id, p."businessName", p.email, p."walletBalanceKobo", p.status, p."createdAt", p."updatedAt"
  FROM public."Partner" p
  JOIN public."PartnerTransaction" t ON t."partnerId" = p.id
  WHERE t."createdAt" >= TIMESTAMP '__CUTOFF__'
)
SELECT count(*)::text || '|' || coalesce(sum(hashtextextended(
  jsonb_build_object('id',id,'businessName',"businessName",'email',email,'walletBalanceKobo',"walletBalanceKobo",'status',status,'createdAt',"createdAt",'updatedAt',"updatedAt")::text,
  0)::numeric),0)::text
FROM selected;
'@
  $partnerStateSql = $partnerStateSql.Replace('__CUTOFF__', $cutoffText)
  $partnerSourceState = Invoke-PsqlFile $source $partnerStateSql $queryFile 'Source partner verification query'
  $partnerParts = $partnerSourceState.Split('|')
  if ($partnerParts.Count -ne 2) { throw 'Could not parse source partner count/fingerprint.' }
  $partnerCount = [Int64]::Parse($partnerParts[0])

  $transactionStateSql = @'
WITH selected AS (
  SELECT t.id, t."partnerId", t.type, t.status, t."amountKobo", t."balanceBeforeKobo", t."balanceAfterKobo",
    t.provider, t."providerRef", t.reference, t."idempotencyKey", t.description, t."createdAt", t."updatedAt", t."costKobo"
  FROM public."PartnerTransaction" t
  WHERE t."createdAt" >= TIMESTAMP '__CUTOFF__'
)
SELECT count(*)::text || '|' || coalesce(sum(
  pg_column_size(id) + pg_column_size("partnerId") + pg_column_size(type) + pg_column_size(status) +
  pg_column_size("amountKobo") + pg_column_size("balanceBeforeKobo") + pg_column_size("balanceAfterKobo") +
  coalesce(pg_column_size(provider),0) + coalesce(pg_column_size("providerRef"),0) + pg_column_size(reference) +
  pg_column_size("idempotencyKey") + pg_column_size(description) + pg_column_size("createdAt") +
  pg_column_size("updatedAt") + coalesce(pg_column_size("costKobo"),0)
),0)::text || '|' || coalesce(sum(hashtextextended(to_jsonb(selected)::text,0)::numeric),0)::text
FROM selected;
'@
  $transactionStateSql = $transactionStateSql.Replace('__CUTOFF__', $cutoffText)
  $transactionSourceState = Invoke-PsqlFile $source $transactionStateSql $queryFile 'Source partner transaction estimate'
  $transactionParts = $transactionSourceState.Split('|')
  if ($transactionParts.Count -ne 3) { throw 'Could not parse source partner transaction estimate.' }
  $transactionCount = [Int64]::Parse($transactionParts[0])
  $transactionBytes = [Int64]::Parse($transactionParts[1])

  $columnProfileSql = @'
SELECT string_agg(format('%s=%s', key, bytes), '|' ORDER BY bytes DESC)
FROM (
  SELECT e.key, sum(pg_column_size(e.value))::bigint AS bytes
  FROM public."PartnerTransaction" t
  CROSS JOIN LATERAL jsonb_each(to_jsonb(t)) AS e(key, value)
  WHERE t."createdAt" >= TIMESTAMP '__CUTOFF__'
  GROUP BY e.key
) AS sizes;
'@
  $columnProfileSql = $columnProfileSql.Replace('__CUTOFF__', $cutoffText)
  $columnProfile = Invoke-PsqlFile $source $columnProfileSql $queryFile 'Partner transaction column size profile'
  Write-Output "Partner transaction field sizes (JSONB representation): $columnProfile"

  $destinationTablesSql = @'
SELECT ((SELECT count(*) FROM public."Partner") + (SELECT count(*) FROM public."PartnerTransaction"))::text;
'@
  $destinationPartnerRows = [Int64]::Parse((Invoke-PsqlFile $target $destinationTablesSql $queryFile 'Destination partner preflight'))
  if ($destinationPartnerRows -ne 0) { throw 'Destination already contains partner data; no partner restore was started.' }

  $targetBytes = [Int64]::Parse((Invoke-PsqlFile $target 'SELECT pg_database_size(current_database());' $queryFile 'Destination size preflight'))
  $projectedBytes = $targetBytes + ($transactionBytes * 1.35) + ($partnerCount * 512) + 30MB
  Write-Output "Partner preflight: $partnerCount related partners; $transactionCount transactions; $([Math]::Round($transactionBytes / 1MB, 2)) MiB raw row estimate; target currently $([Math]::Round($targetBytes / 1MB, 2)) MiB."
  if ($projectedBytes -gt 500000000) { throw "Projected database size $([Math]::Round($projectedBytes / 1MB, 2)) MiB exceeds the Free plan 500 MB quota; no partner data was restored." }

  $transactionHash = $transactionParts[2]
  $partnerExportCommand = '\copy (SELECT p.id, p."businessName", p.email, p."walletBalanceKobo", p.status::text, p."createdAt", p."updatedAt" FROM public."Partner" p WHERE EXISTS (SELECT 1 FROM public."PartnerTransaction" t WHERE t."partnerId"=p.id AND t."createdAt" >= {0}) ORDER BY p.id) TO ''{1}'' WITH (FORMAT csv, HEADER true)' -f $cutoff, $partnerCsvFile.Replace('\', '/')
  Set-Content -LiteralPath $copyOutSql -Value $partnerExportCommand -Encoding ASCII
  $partnerExportOutput = Invoke-Psql $source @('-X', '-v', 'ON_ERROR_STOP=1', '-h', $source.Uri.Host, '-p', [string]$source.Uri.Port, '-U', $source.User, '-d', $source.Database, '-f', $copyOutSql) 'Selected partner export'
  $partnerCopyMatch = [regex]::Match($partnerExportOutput, '\bCOPY\s+(\d+)\b')
  if (-not $partnerCopyMatch.Success -or [Int64]$partnerCopyMatch.Groups[1].Value -ne $partnerCount) { throw 'Selected partner export count did not match the source estimate.' }

  $exportCommand = '\copy (SELECT id, "partnerId", type, status, "amountKobo", "balanceBeforeKobo", "balanceAfterKobo", provider, "providerRef", reference, "idempotencyKey", description, "createdAt", "updatedAt", "costKobo" FROM public."PartnerTransaction" WHERE "createdAt" >= {0} ORDER BY "createdAt", id) TO ''{1}'' WITH (FORMAT csv, HEADER true)' -f $cutoff, $csvFile.Replace('\', '/')
  Set-Content -LiteralPath $copyOutSql -Value $exportCommand -Encoding ASCII
  $exportOutput = Invoke-Psql $source @('-X', '-v', 'ON_ERROR_STOP=1', '-h', $source.Uri.Host, '-p', [string]$source.Uri.Port, '-U', $source.User, '-d', $source.Database, '-f', $copyOutSql) 'Filtered partner transaction export'
  $copyMatch = [regex]::Match($exportOutput, '\bCOPY\s+(\d+)\b')
  if (-not $copyMatch.Success -or [Int64]$copyMatch.Groups[1].Value -ne $transactionCount) { throw 'Partner transaction export count did not match the source estimate.' }

  $partnerImportCommand = '\copy public."Partner" (id, "businessName", email, "walletBalanceKobo", status, "createdAt", "updatedAt") FROM ''{0}'' WITH (FORMAT csv, HEADER true)' -f $partnerCsvFile.Replace('\', '/')
  $transactionImportCommand = '\copy public."PartnerTransaction" (id, "partnerId", type, status, "amountKobo", "balanceBeforeKobo", "balanceAfterKobo", provider, "providerRef", reference, "idempotencyKey", description, "createdAt", "updatedAt", "costKobo") FROM ''{0}'' WITH (FORMAT csv, HEADER true)' -f $csvFile.Replace('\', '/')
  @('BEGIN;', $partnerImportCommand, $transactionImportCommand, 'COMMIT;') | Set-Content -LiteralPath $copyInSql -Encoding ASCII
  $importOutput = Invoke-Psql $target @('-X', '-v', 'ON_ERROR_STOP=1', '-h', $target.Uri.Host, '-p', [string]$target.Uri.Port, '-U', $target.User, '-d', $target.Database, '-f', $copyInSql) 'Partner data import'
  $importCounts = @([regex]::Matches($importOutput, '\bCOPY\s+(\d+)\b') | ForEach-Object { [Int64]$_.Groups[1].Value })
  if ($importCounts.Count -ne 2 -or $importCounts[0] -ne $partnerCount -or $importCounts[1] -ne $transactionCount) { throw 'Imported partner and transaction counts did not match the exports.' }

  $partnerTargetState = Invoke-PsqlFile $target $partnerStateSql $queryFile 'Destination partner verification query'
  $transactionTargetState = Invoke-PsqlFile $target $transactionStateSql $queryFile 'Destination partner transaction verification query'
  if ($partnerTargetState -ne $partnerSourceState) { throw 'Partner count/fingerprint did not match the source.' }
  if ($transactionTargetState -ne $transactionSourceState) { throw 'Partner transaction count/fingerprint did not match the source.' }

  $finalBytes = [Int64]::Parse((Invoke-PsqlFile $target 'SELECT pg_database_size(current_database());' $queryFile 'Final destination size check'))
  if ($finalBytes -gt 500000000) { throw 'Destination database size is above the Free plan 500 MB quota.' }
  Write-Output "Partner migration verified: $partnerCount related partner records; $transactionCount transactions since $cutoffText UTC. Large transaction metadata was omitted; transaction IDs, amounts, balances, status, references, descriptions, provider, and timestamps were retained."
  Write-Output "Destination database size: $([Math]::Round($finalBytes / 1MB, 2)) MiB."
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  foreach ($temporaryFile in @($partnerCsvFile, $csvFile, $copyOutSql, $copyInSql, $queryFile)) {
    if ($temporaryFile -and (Test-Path -LiteralPath $temporaryFile)) { Remove-Item -LiteralPath $temporaryFile -Force -ErrorAction SilentlyContinue }
  }
  $source.Password = $null
  $target.Password = $null
  $settings['SOURCE_DATABASE_URL'] = $null
  $settings['TARGET_DATABASE_URL'] = $null
}
