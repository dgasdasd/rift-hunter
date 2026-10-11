$ErrorActionPreference = 'Stop'
$gameRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { 'D:\node22版\node-v22.14.0-win-x64\node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) { throw '请先安装 Node.js 22 或更新版本。' }
if (-not (Test-Path -LiteralPath (Join-Path $gameRoot 'dist\index.html'))) { throw '缺少游戏构建文件，请在游戏目录执行 npm run build。' }
$gameUrl = 'http://127.0.0.1:5178/'
$listener = Get-NetTCPConnection -LocalPort 5178 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    $response = Invoke-WebRequest -Uri $gameUrl -UseBasicParsing -TimeoutSec 5
    if ($response.Content -notmatch 'RIFT HUNTER') { throw '5178 端口正被其他程序占用，请关闭占用程序后再启动。' }
    if (@($listener | Where-Object { $_.LocalAddress -notin @('127.0.0.1','::1') }).Count -eq 0) {
        $runningPreview = Get-CimInstance Win32_Process -Filter ("ProcessId = " + $listener[0].OwningProcess)
        if ($runningPreview.Name -eq 'node.exe' -and $runningPreview.CommandLine -like '*vite.js preview*--port 5178*') {
            Stop-Process -Id $runningPreview.ProcessId -Force
            $listener = $null
        } else { throw '现有预览仅限电脑访问，请关闭旧预览后重新启动。' }
    }
}
if (-not $listener) {
    Start-Process -FilePath $nodePath -ArgumentList 'node_modules/vite/bin/vite.js','preview','--host','0.0.0.0','--port','5178','--strictPort' -WorkingDirectory $gameRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $gameRoot 'preview.log') -RedirectStandardError (Join-Path $gameRoot 'preview-error.log') | Out-Null
    for ($attempt = 0; $attempt -lt 15; $attempt++) {
        Start-Sleep -Milliseconds 400
        if (Get-NetTCPConnection -LocalPort 5178 -State Listen -ErrorAction SilentlyContinue) { break }
    }
}
Start-Process $gameUrl
