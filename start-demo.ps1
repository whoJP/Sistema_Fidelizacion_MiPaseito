<#
  Levanta Paseo Points para la demo en http://localhost:4000

    .\start-demo.ps1          inicia MySQL (si hace falta), migra, compila el frontend y arranca la API
    .\start-demo.ps1 -Reset   además recarga los datos de demo (borra todo lo creado)

  Requiere MySQL 8.4 en %USERPROFILE%\mysql8 (o MYSQL_HOME) y Node 24.
#>
param([switch]$Reset)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$mysqlHome = if ($env:MYSQL_HOME) { $env:MYSQL_HOME } else { Join-Path $env:USERPROFILE 'mysql8' }

function Test-Port([int]$port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try { $client.Connect('127.0.0.1', $port); $true } catch { $false } finally { $client.Dispose() }
}

function Invoke-Step([string]$label, [string]$dir, [string]$command) {
  Write-Host "==> $label" -ForegroundColor Cyan
  Push-Location $dir
  try {
    cmd /c $command
    if ($LASTEXITCODE -ne 0) { throw "Falló: $label" }
  } finally { Pop-Location }
}

$envFile = Join-Path $root 'backend\.env'
$usesLocalDb = [bool](Get-Content $envFile -ErrorAction SilentlyContinue | Select-String '^DATABASE_URL=.*@(localhost|127\.0\.0\.1)[:/]')

if (-not $usesLocalDb) {
  Write-Host '==> Usando la base de datos remota de DATABASE_URL' -ForegroundColor Cyan
} elseif (Test-Port 3306) {
  Write-Host '==> MySQL ya está escuchando en :3306' -ForegroundColor Cyan
} else {
  $mysqld = Get-ChildItem -Path $mysqlHome -Filter mysqld.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $mysqld) { throw "No encontré mysqld.exe en $mysqlHome. Define MYSQL_HOME o inicia MySQL manualmente." }
  Write-Host "==> Iniciando MySQL ($($mysqld.FullName))" -ForegroundColor Cyan
  Start-Process -FilePath $mysqld.FullName -ArgumentList "--defaults-file=`"$(Join-Path $mysqlHome 'my.ini')`"", '--console' -WindowStyle Minimized
  $deadline = (Get-Date).AddSeconds(30)
  while (-not (Test-Port 3306)) {
    if ((Get-Date) -gt $deadline) { throw 'MySQL no respondió en 30 s.' }
    Start-Sleep -Milliseconds 500
  }
}

if (Test-Port 4000) { throw 'El puerto 4000 ya está en uso: cierra la API que esté corriendo antes de continuar.' }

$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

if (-not (Test-Path (Join-Path $backend 'node_modules'))) { Invoke-Step 'Instalando dependencias del backend' $backend 'npm install' }
if (-not (Test-Path (Join-Path $frontend 'node_modules'))) { Invoke-Step 'Instalando dependencias del frontend' $frontend 'npm install' }

Invoke-Step 'Generando cliente Prisma' $backend 'npm run db:generate'
Invoke-Step 'Aplicando migraciones' $backend 'npm run db:migrate'
if ($Reset) { Invoke-Step 'Cargando datos de demo' $backend 'npm run db:seed' }
Invoke-Step 'Compilando frontend' $frontend 'npm run build'

Write-Host ''
Write-Host 'Paseo Points listo en http://localhost:4000  (cuentas demo, contraseña demo1234)' -ForegroundColor Green
Write-Host 'Desde otro dispositivo en la misma red: http://<IP-de-esta-PC>:4000' -ForegroundColor Green
Write-Host ''
Invoke-Step 'Iniciando API (Ctrl+C para detener)' $backend 'npm start'
