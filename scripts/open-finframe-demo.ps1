# 双击桌面「打开 FinFrame.bat」时运行。
# 演示页已在跑就直接打开浏览器；否则用现有开发启动脚本拉起服务后再打开。
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$repo = 'D:\canvas agent'
$devScript = Join-Path $repo 'node_modules\.cache\dev-on-d.ps1'
$webPorts = 5173..5189
$apiPorts = 8711..8731
$startTimeoutSec = 150
$apiWaitAfterWebSec = 30

function Test-Url([string]$Url) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri $Url
    return ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400)
  } catch {
    return $false
  }
}

function Find-WebPort {
  foreach ($port in $webPorts) {
    if (Test-Url "http://127.0.0.1:$port/") { return $port }
  }
  return $null
}

function Test-ApiReady {
  foreach ($port in $apiPorts) {
    if (Test-Url "http://127.0.0.1:$port/api/health") { return $true }
  }
  return $false
}

function Start-DevWindow {
  if (-not (Test-Path -LiteralPath $devScript)) {
    throw "找不到开发启动脚本：$devScript"
  }
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $psi.Arguments = "-NoExit -NoProfile -ExecutionPolicy Bypass -File `"$devScript`""
  $psi.WorkingDirectory = $repo
  $psi.UseShellExecute = $true
  [void][System.Diagnostics.Process]::Start($psi)
}

try {
  $Host.UI.RawUI.WindowTitle = 'FinFrame'
} catch {}

$port = Find-WebPort
if (-not $port) {
  Write-Host 'FinFrame 还没启动，正在拉起服务…'
  $mutex = New-Object System.Threading.Mutex($false, 'Local\FinFrameDemoLauncher')
  $owned = $false
  try {
    $owned = $mutex.WaitOne(0)
  } catch {
    $owned = $true
  }
  try {
    if ($owned) { Start-DevWindow }
    $deadline = (Get-Date).AddSeconds($startTimeoutSec)
    $webSince = $null
    while ((Get-Date) -lt $deadline) {
      $port = Find-WebPort
      if ($port) {
        if (-not $webSince) {
          $webSince = Get-Date
          Write-Host "网页已起来（端口 $port），等待接口…"
        }
        if (Test-ApiReady) { break }
        if (((Get-Date) - $webSince).TotalSeconds -ge $apiWaitAfterWebSec) { break }
      }
      Start-Sleep -Seconds 2
    }
  } finally {
    if ($owned) {
      try { [void]$mutex.ReleaseMutex() } catch {}
    }
    $mutex.Dispose()
  }
}

if (-not $port) {
  Write-Host '等待超时。请看标题为 FinFrame 的服务窗口里的报错。'
  exit 1
}

$url = "http://127.0.0.1:$port/"
Write-Host "正在打开 $url"
Start-Process $url
exit 0
