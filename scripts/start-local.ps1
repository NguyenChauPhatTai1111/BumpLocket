$ErrorActionPreference = 'Stop'
$projectPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$env:OPENSSL_CONF = 'C:/laragon/bin/php/php-8.3.26-Win32-vs16-x64/extras/ssl/openssl.cnf'
$redisPath = 'C:/laragon/bin/redis/redis-x64-5.0.14.1/redis-server.exe'
$logPath = Join-Path $projectPath 'storage/logs'
$redisProcess = Start-Process -FilePath $redisPath -ArgumentList '--port 6379 --bind 127.0.0.1 --save "" --appendonly no' -WorkingDirectory $projectPath -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logPath 'redis.log') -RedirectStandardError (Join-Path $logPath 'redis-error.log')
$reverbProcess = Start-Process -FilePath 'php' -ArgumentList 'artisan reverb:start --host=127.0.0.1 --port=8080' -WorkingDirectory $projectPath -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logPath 'reverb.log') -RedirectStandardError (Join-Path $logPath 'reverb-error.log')
$queueProcess = Start-Process -FilePath 'php' -ArgumentList 'artisan queue:work --sleep=1 --tries=2 --timeout=60' -WorkingDirectory $projectPath -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logPath 'queue.log') -RedirectStandardError (Join-Path $logPath 'queue-error.log')
$scheduleProcess = Start-Process -FilePath 'php' -ArgumentList 'artisan schedule:work' -WorkingDirectory $projectPath -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logPath 'schedule.log') -RedirectStandardError (Join-Path $logPath 'schedule-error.log')
Write-Output "Started Redis PID=$($redisProcess.Id), Reverb PID=$($reverbProcess.Id), Queue PID=$($queueProcess.Id), Scheduler PID=$($scheduleProcess.Id)"
