param(
	[int]$Port = 9222,
	[string]$Address = "0.0.0.0",
	[string]$ProfileDir = "",
	[string]$IpcDir = "",
	[switch]$Foreground
)

$ErrorActionPreference = "Stop"

function Find-BrowserExecutable {
	if ($env:WEB_ACCESS_CHROME_PATH -and (Test-Path -LiteralPath $env:WEB_ACCESS_CHROME_PATH)) {
		return $env:WEB_ACCESS_CHROME_PATH
	}
	if ($env:CHROME_PATH -and (Test-Path -LiteralPath $env:CHROME_PATH)) {
		return $env:CHROME_PATH
	}

	$candidates = @(
		"$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
		"${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
		"$env:LocalAppData\Google\Chrome\Application\chrome.exe"
	)

	if ($env:WEB_ACCESS_ALLOW_EDGE -eq "1") {
		$candidates += @(
			"$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
			"${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
			"$env:LocalAppData\Microsoft\Edge\Application\msedge.exe"
		)
	}

	foreach ($candidate in $candidates) {
		if ($candidate -and (Test-Path -LiteralPath $candidate)) {
			return $candidate
		}
	}

	throw "No Chrome executable found. Set WEB_ACCESS_CHROME_PATH to your browser executable."
}

if (-not $ProfileDir) {
	$ProfileDir = Join-Path (Get-Location) ".data\web-access-chrome-profile"
}

if (-not $IpcDir) {
	$IpcDir = Join-Path (Get-Location) ".data\browser-ipc"
}

New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null
New-Item -ItemType Directory -Force -Path $IpcDir | Out-Null
$browser = Find-BrowserExecutable
$daemon = Join-Path (Get-Location) "runtime\skills-user\web-access\scripts\host-browser-bridge-daemon.mjs"
$logDir = Join-Path (Get-Location) ".data\logs"
$outLog = Join-Path $logDir "web-access-host-bridge.out.log"
$errLog = Join-Path $logDir "web-access-host-bridge.err.log"
$readyFile = Join-Path $IpcDir "host-bridge-ready.json"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
if (Test-Path -LiteralPath $readyFile) {
	try {
		$ready = Get-Content -Raw -LiteralPath $readyFile | ConvertFrom-Json
		if ($ready.pid) {
			$oldProcess = Get-Process -Id ([int]$ready.pid) -ErrorAction SilentlyContinue
			if ($oldProcess) {
				Stop-Process -Id ([int]$ready.pid) -Force
			}
		}
	} catch {
		# Stale or invalid ready files are harmless; the new bridge will replace them.
	}
	Remove-Item -Force -LiteralPath $readyFile
}

$env:WEB_ACCESS_CDP_PORT = [string]$Port
$env:WEB_ACCESS_CDP_HOST = "127.0.0.1"
$env:WEB_ACCESS_CDP_LISTEN_ADDRESS = $Address
$env:WEB_ACCESS_CHROME_PATH = $browser
$env:WEB_ACCESS_CHROME_PROFILE_DIR = $ProfileDir
$env:NANOCLAW_BROWSER_BRIDGE_DIR = $IpcDir

$debugChromeProcesses = Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" |
	Where-Object { $_.CommandLine -like "*--remote-debugging-port=$Port*" }

foreach ($chromeProcess in $debugChromeProcesses) {
	$commandLine = [string]$chromeProcess.CommandLine
	if ($commandLine -notlike "*--user-data-dir=$ProfileDir*") {
		Stop-Process -Id ([int]$chromeProcess.ProcessId) -Force -ErrorAction SilentlyContinue
	}
}

Write-Host "Starting web-access host bridge:"
Write-Host "  executable: $browser"
Write-Host "  CDP:        http://127.0.0.1:$Port"
Write-Host "  Docker:     http://host.docker.internal:$Port"
Write-Host "  profile:    $ProfileDir"
Write-Host "  IPC:        $IpcDir"

if ($Foreground) {
	& node $daemon
	exit $LASTEXITCODE
}

$process = Start-Process `
	-FilePath "node" `
	-ArgumentList @($daemon) `
	-WorkingDirectory (Get-Location) `
	-RedirectStandardOutput $outLog `
	-RedirectStandardError $errLog `
	-WindowStyle Hidden `
	-PassThru

for ($i = 0; $i -lt 30; $i += 1) {
	if (Test-Path -LiteralPath $readyFile) {
		Write-Host "web-access host bridge ready. pid=$($process.Id)"
		Write-Host "Chrome will be started automatically when the agent sends an IPC browser request."
		exit 0
	}
	Start-Sleep -Milliseconds 500
}

throw "Host bridge did not become ready. Check logs: $outLog and $errLog"
