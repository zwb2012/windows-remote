param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$host.UI.RawUI.WindowTitle = "Windows Remote Tunnel"

$cloudflaredPath = "D:\ProgramData\Cloudflare\cloudflared.exe"
$logsDir = Join-Path $ProjectRoot "logs"
$logPath = Join-Path $logsDir "tunnel.log"
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

while ($true) {
    $startedAt = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Log "start-time: $startedAt"
    Write-Log "Starting cloudflared tunnel --url http://localhost:3000"

    $exitCode = $null

    Push-Location $ProjectRoot
    try {
        & $cloudflaredPath tunnel --url http://localhost:3000 2>&1 | ForEach-Object {
            $line = [string]$_
            Write-Host $line
            Append-LogFile $line
        }
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
