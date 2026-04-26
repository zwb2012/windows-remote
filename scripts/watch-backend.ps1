param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$host.UI.RawUI.WindowTitle = "Windows Remote Backend"

$logsDir = Join-Path $ProjectRoot "logs"
$logPath = Join-Path $logsDir "backend.log"
New-Item -ItemType Directory -Path $logsDir -Force | Out-Null

function Append-LogFile {
    param([string]$Message)
    $Message | Out-File -FilePath $logPath -Append -Encoding utf8
}

function Write-Log {
    param([string]$Message)
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Write-Host $line
    Append-LogFile $line
}

function Write-BackendOutput {
    param([string]$Message)
    if ($Message -match '^Access URL:\s+http://localhost:\d+/\?token=') {
        $displayLine = $Message
        $logLine = $Message -replace '(\?token=).*$', '$1[REDACTED]'
        Write-Host $displayLine
        Append-LogFile $logLine
        return
    }

    Write-Host $Message
    Append-LogFile $Message
}

while ($true) {
    $startedAt = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Log "start-time: $startedAt"
    Write-Log "Starting npm start"

    $exitCode = $null

    Push-Location $ProjectRoot
    try {
        & npm start 2>&1 | ForEach-Object { Write-BackendOutput ([string]$_) }
        $exitCode = $LASTEXITCODE
    }
    catch {
        Write-Log "Launch failed: $($_.Exception.Message)"
        $exitCode = 1
    }
    finally {
        Pop-Location
    }

    if ($null -eq $exitCode) {
        $exitCode = 0
    }

    Write-Log "Process exited with code $exitCode"
    Write-Log "restart-in-5-seconds"
    Start-Sleep -Seconds 5
}
