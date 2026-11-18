$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env.local'
$backupFile = 'D:\MajorDataLinkBackups\major-data-link-public-20261118-133352.dump'
$backupDirectory = 'D:\MajorDataLinkBackups'
$pgBin = 'C:\Program Files\PostgreSQL\17\bin'

foreach ($tool in @('psql.exe', 'pg_restore.exe')) {
  if (-not (Test-Path -LiteralPath (Join-Path $pgBin $tool))) {
    throw "Required PostgreSQL client tool is missing: $tool"
  }
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
$csvFile = Join-Path $backupDirectory "retail-transactions-$stamp.csv"
$copyOutSql = Join-Path $backupDirectory "copy-out-$stamp.sql"
$copyInSql = Join-Path $backupDirectory "copy-in-$stamp.sql"
$queryFile = Join-Path $backupDirectory "migration-query-$stamp.sql"
$schemaList = Join-Path $backupDirectory "schema-list-$stamp.txt"
$dataList = Join-Path $backupDirectory "data-list-$stamp.txt"

try {
  $cutoffText = Invoke-Psql $source @('-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', $source.Uri.Host, '-p', [string]$source.Uri.Port, '-U', $source.User, '-d', $source.Database, '-c', "SELECT to_char((now() - interval '20 days') AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US');") 'Source cutoff query'
  if ($cutoffText -notmatch '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$') { throw 'The source returned an unexpected 20-day cutoff.' }
  $cutoff = "TIMESTAMP '$cutoffText'"
  $transactionEstimateSql = @'
WITH RECURSIVE keep_ids(id) AS (
  SELECT id FROM public."Transaction" WHERE "createdAt" >= __CUTOFF__
  UNION
  SELECT t."relatedTransactionId" FROM public."Transaction" t
    JOIN keep_ids k ON t.id = k.id
    WHERE t."relatedTransactionId" IS NOT NULL
)
SELECT count(*)::text || '|' || coalesce(sum(pg_column_size(t)),0)::text || '|' ||
  md5(coalesce(string_agg(to_jsonb(t)::text, '' ORDER BY t.id),''))
FROM public."Transaction" t JOIN keep_ids k ON k.id=t.id;
'@
  $transactionEstimateSql = $transactionEstimateSql.Replace('__CUTOFF__', $cutoff)
  $transactionEstimate = Invoke-PsqlFile $source $transactionEstimateSql $queryFile 'Transaction size estimate'
  $estimateParts = $transactionEstimate.Split('|')
  if ($estimateParts.Count -ne 3) { throw 'Could not parse the selected transaction estimate.' }
  $transactionCount = [Int64]::Parse($estimateParts[0])
  $transactionBytes = [Int64]::Parse($estimateParts[1])
  $transactionHash = $estimateParts[2]

  $userStateSql = @'
SELECT count(*)::text || '|' || md5(coalesce(string_agg(to_jsonb(u)::text, '' ORDER BY u.id),''))
FROM public."User" u;
'@
  $userSourceState = Invoke-PsqlFile $source $userStateSql $queryFile 'Source user verification query'
  $userParts = $userSourceState.Split('|')
  if ($userParts.Count -ne 2) { throw 'Could not parse the source user count and fingerprint.' }
  $userCount = [Int64]::Parse($userParts[0])
  $userHash = $userParts[1]

  $exportCommand = '\copy (WITH RECURSIVE keep_ids(id) AS (SELECT id FROM public."Transaction" WHERE "createdAt" >= {0} UNION SELECT t."relatedTransactionId" FROM public."Transaction" t JOIN keep_ids k ON t.id = k.id WHERE t."relatedTransactionId" IS NOT NULL) SELECT t.* FROM public."Transaction" t JOIN keep_ids k ON k.id = t.id ORDER BY t."createdAt", t.id) TO ''{1}'' WITH (FORMAT csv, HEADER true)' -f $cutoff, $csvFile.Replace('\', '/')
  Set-Content -LiteralPath $copyOutSql -Value $exportCommand -Encoding ASCII
  $exportOutput = Invoke-Psql $source @('-X', '-v', 'ON_ERROR_STOP=1', '-h', $source.Uri.Host, '-p', [string]$source.Uri.Port, '-U', $source.User, '-d', $source.Database, '-f', $copyOutSql) 'Filtered transaction export'
  $copyMatch = [regex]::Match($exportOutput, '\bCOPY\s+(\d+)\b')
  if (-not $copyMatch.Success -or [Int64]$copyMatch.Groups[1].Value -ne $transactionCount) { throw 'The filtered transaction export count did not match the source estimate.' }
  $csvSize = (Get-Item -LiteralPath $csvFile).Length
  Write-Output "Selected users: $userCount; retail transactions to import: $transactionCount (including linked older rows)."
  Write-Output "20-day cutoff UTC: $cutoffText; transaction CSV: $([Math]::Round($csvSize / 1MB, 2)) MiB."

  $targetTables = Invoke-Psql $target @('-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', $target.Uri.Host, '-p', [string]$target.Uri.Port, '-U', $target.User, '-d', $target.Database, '-c', "SELECT count(*) FROM pg_tables WHERE schemaname='public';") 'Destination preflight'
  if ([Int64]::Parse($targetTables) -ne 0) { throw 'Destination public schema is not empty; no restore was started.' }

  $toc = & (Join-Path $pgBin 'pg_restore.exe') -l $backupFile
  if ($LASTEXITCODE -ne 0) { throw 'Could not read the validated backup table of contents.' }
  $publicSchemaEntryCount = @($toc | Where-Object { $_ -match '^\s*\d+;\s+\d+\s+\d+\s+SCHEMA - public\b' }).Count
  if ($publicSchemaEntryCount -ne 1) { throw 'Expected exactly one public schema entry in the backup.' }
  @($toc | Where-Object { $_ -notmatch '^\s*\d+;\s+\d+\s+\d+\s+SCHEMA - public\b' }) | Set-Content -LiteralPath $schemaList -Encoding ASCII

  $schemaArgs = @('-h', $target.Uri.Host, '-p', [string]$target.Uri.Port, '-U', $target.User, '-d', $target.Database, '--schema-only', '--use-list', $schemaList, '--no-owner', '--no-acl', '--exit-on-error', '--single-transaction', $backupFile)
  Invoke-PgRestore $target $schemaArgs 'Destination schema restore'

  $smallDataPattern = '^\s*\d+;\s+\d+\s+\d+\s+TABLE DATA public (_prisma_migrations|User|AdminUser|AdminRecoveryCode|AppConfig|DataPlanPricing|PricingSettings|ReferralSettings|ServicePricing) postgres$'
  $smallDataEntries = @($toc | Where-Object { $_ -match $smallDataPattern })
  if ($smallDataEntries.Count -ne 9) { throw "Expected 9 lightweight/user data entries; found $($smallDataEntries.Count)." }
  $smallDataEntries | Set-Content -LiteralPath $dataList -Encoding ASCII
  $smallDataArgs = @('-h', $target.Uri.Host, '-p', [string]$target.Uri.Port, '-U', $target.User, '-d', $target.Database, '--data-only', '--use-list', $dataList, '--no-owner', '--no-acl', '--exit-on-error', '--single-transaction', $backupFile)
  Invoke-PgRestore $target $smallDataArgs 'Selected user and configuration data restore'

  $targetPreTransactionBytes = [Int64]::Parse((Invoke-Psql $target @('-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', $target.Uri.Host, '-p', [string]$target.Uri.Port, '-U', $target.User, '-d', $target.Database, '-c', 'SELECT pg_database_size(current_database());') 'Destination size check'))
  if ($targetPreTransactionBytes + $transactionBytes + 100MB -gt 500MB) { throw 'Projected destination size exceeds the 500 MiB Free plan database quota; recent transactions were not restored.' }

  $importCommand = '\copy public."Transaction" FROM ''{0}'' WITH (FORMAT csv, HEADER true)' -f $csvFile.Replace('\', '/')
  Set-Content -LiteralPath $copyInSql -Value $importCommand -Encoding ASCII
  $importOutput = Invoke-Psql $target @('-X', '-v', 'ON_ERROR_STOP=1', '-h', $target.Uri.Host, '-p', [string]$target.Uri.Port, '-U', $target.User, '-d', $target.Database, '-f', $copyInSql) 'Filtered transaction import'
  $importMatch = [regex]::Match($importOutput, '\bCOPY\s+(\d+)\b')
  if (-not $importMatch.Success -or [Int64]$importMatch.Groups[1].Value -ne $transactionCount) { throw 'The imported transaction count did not match the exported count.' }

  $targetUserState = Invoke-PsqlFile $target $userStateSql $queryFile 'Destination user verification query'
  $targetTransactionState = Invoke-PsqlFile $target $transactionEstimateSql $queryFile 'Destination transaction verification query'
  if ($targetUserState -ne $userSourceState) { throw 'Destination user count/fingerprint did not match the source.' }
  if ($targetTransactionState -ne $transactionEstimate) { throw 'Destination selected transaction count/fingerprint did not match the source.' }

  $finalBytes = [Int64]::Parse((Invoke-Psql $target @('-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', $target.Uri.Host, '-p', [string]$target.Uri.Port, '-U', $target.User, '-d', $target.Database, '-c', 'SELECT pg_database_size(current_database());') 'Final destination size check'))
  if ($finalBytes -gt 500MB) { throw 'Destination database size is above the Free plan 500 MiB quota.' }
  $fileRows = Invoke-PsqlFile $target 'SELECT count(*) FROM public."UserDelivery";' $queryFile 'File-row verification query'
  if ([Int64]::Parse($fileRows) -ne 0) { throw 'Unexpected UserDelivery rows exist in the destination.' }

  Write-Output "Migration verified: $userCount users; $transactionCount retail transactions; UserDelivery rows: 0."
  Write-Output "Destination database size: $([Math]::Round($finalBytes / 1MB, 2)) MiB."
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  foreach ($temporaryFile in @($csvFile, $copyOutSql, $copyInSql, $queryFile, $schemaList, $dataList)) {
    if ($temporaryFile -and (Test-Path -LiteralPath $temporaryFile)) { Remove-Item -LiteralPath $temporaryFile -Force -ErrorAction SilentlyContinue }
  }
  $source.Password = $null
  $target.Password = $null
  $settings['SOURCE_DATABASE_URL'] = $null
  $settings['TARGET_DATABASE_URL'] = $null
}
