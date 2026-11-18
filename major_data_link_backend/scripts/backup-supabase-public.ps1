$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env.local'
$pgBin = 'C:\Program Files\PostgreSQL\17\bin'
$backupDirectory = 'D:\MajorDataLinkBackups'

if (-not (Test-Path -LiteralPath $envFile)) {
  throw 'Cannot find major_data_link_backend\.env.local.'
}
foreach ($tool in @('psql.exe', 'pg_dump.exe', 'pg_restore.exe')) {
  if (-not (Test-Path -LiteralPath (Join-Path $pgBin $tool))) {
    throw "Required PostgreSQL client tool is missing: $tool"
  }
}
if (-not (Test-Path -LiteralPath $backupDirectory)) {
  throw 'Backup directory D:\MajorDataLinkBackups does not exist.'
}

$settings = @{}
Get-Content -LiteralPath $envFile | ForEach-Object {
  if ($_ -match '^\s*(SOURCE_DATABASE_URL|TARGET_DATABASE_URL)\s*=\s*(.*)$') {
    $settings[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
  }
}
if (-not $settings['SOURCE_DATABASE_URL']) { throw 'SOURCE_DATABASE_URL is missing from .env.local.' }
if (-not $settings['TARGET_DATABASE_URL']) { throw 'TARGET_DATABASE_URL is missing from .env.local.' }

$sourceUri = [Uri]$settings['SOURCE_DATABASE_URL']
$targetUri = [Uri]$settings['TARGET_DATABASE_URL']
function Get-ProjectDatabaseCredentials([Uri]$uri, [string]$projectRef, [string]$label) {
  if ($uri.Port -ne 5432) { throw "$label must use direct or Session pooler port 5432." }

  $parts = $uri.UserInfo.Split(':', 2)
  if ($parts.Count -ne 2) { throw "$label must include a username and password." }
  $username = [Uri]::UnescapeDataString($parts[0])
  $isDirect = $uri.Host -eq "db.$projectRef.supabase.co" -and $username -eq 'postgres'
  $isSessionPooler = $uri.Host.EndsWith('.pooler.supabase.com', [StringComparison]::OrdinalIgnoreCase) -and $username -eq "postgres.$projectRef"
  if (-not ($isDirect -or $isSessionPooler)) {
    throw "$label must be the expected project's direct URL or Session pooler URL."
  }

  return [pscustomobject]@{
    Uri = $uri
    User = $username
    Password = [Uri]::UnescapeDataString($parts[1])
    Database = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
  }
}

$source = Get-ProjectDatabaseCredentials $sourceUri 'xdmtkgiemcsllswlqhbc' 'SOURCE_DATABASE_URL'
$target = Get-ProjectDatabaseCredentials $targetUri 'ctmtzrjyaddmfelxqvzc' 'TARGET_DATABASE_URL'
$sourceUser = $source.User
$sourcePassword = $source.Password
$sourceDatabase = [Uri]::UnescapeDataString($sourceUri.AbsolutePath.TrimStart('/'))
$env:PGPASSWORD = $sourcePassword

try {
  $sizeOutput = & (Join-Path $pgBin 'psql.exe') -X -A -t -h $sourceUri.Host -p $sourceUri.Port -U $sourceUser -d $sourceDatabase -c 'SELECT pg_database_size(current_database());' 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Could not connect to the source database or read its size.' }
  $databaseBytes = [Int64]::Parse(($sizeOutput | Out-String).Trim())
  $freeBytes = (Get-PSDrive -Name D).Free
  $sizeGiB = [Math]::Round($databaseBytes / 1GB, 2)
  $freeGiB = [Math]::Round($freeBytes / 1GB, 2)
  Write-Output "Source database size: $sizeGiB GiB; free space on D: $freeGiB GiB."
  if ($databaseBytes + 512MB -gt $freeBytes) {
    throw 'Not enough free space on D: for a safe backup. No dump was started.'
  }

  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $dumpFile = Join-Path $backupDirectory "major-data-link-public-$stamp.dump"
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $dumpOutput = & (Join-Path $pgBin 'pg_dump.exe') -h $sourceUri.Host -p $sourceUri.Port -U $sourceUser -d $sourceDatabase -F c -Z 6 --schema=public --no-owner --no-acl -f $dumpFile 2>&1
  $dumpExitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorPreference
  if ($dumpOutput) { $dumpOutput | ForEach-Object { Write-Output ([string]$_) } }
  if ($dumpExitCode -ne 0) {
    if (Test-Path -LiteralPath $dumpFile) { Remove-Item -LiteralPath $dumpFile -Force }
    throw 'pg_dump failed. No backup was accepted.'
  }

  $archiveList = & (Join-Path $pgBin 'pg_restore.exe') -l $dumpFile
  $archiveExitCode = $LASTEXITCODE
  if ($archiveExitCode -ne 0 -or -not $archiveList) {
    Remove-Item -LiteralPath $dumpFile -Force
    throw 'The dump did not pass pg_restore archive validation; the file was removed.'
  }

  $tableDataEntries = @($archiveList | Select-String '\bTABLE DATA\b').Count
  $fileInfo = Get-Item -LiteralPath $dumpFile
  $sha256 = (Get-FileHash -LiteralPath $dumpFile -Algorithm SHA256).Hash
  Write-Output "Backup validated: $($fileInfo.FullName)"
  Write-Output "Archive size: $([Math]::Round($fileInfo.Length / 1MB, 2)) MiB; table-data entries: $tableDataEntries"
  Write-Output "SHA256: $sha256"
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  $sourcePassword = $null
  $settings['SOURCE_DATABASE_URL'] = $null
  $settings['TARGET_DATABASE_URL'] = $null
  $sourcePassword = $null
  $target.Password = $null
}
