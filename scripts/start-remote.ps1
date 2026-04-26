param()

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendWatcher = Join-Path $PSScriptRoot "watch-backend.ps1"
$tunnelWatcher = Join-Path $PSScriptRoot "watch-tunnel.ps1"
$cloudflaredPath = "D:\ProgramData\Cloudflare\cloudflared.exe"
$logsDir = Join-Path $projectRoot "logs"
$runtimePidFile = Join-Path $logsDir "runtime-pids.json"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "未找到 npm，请先安装 Node.js 并确保 npm 在 PATH 中。"
    exit 1
}

if (-not (Test-Path -Path $cloudflaredPath -PathType Leaf)) {
    Write-Error "未找到 cloudflared：$cloudflaredPath"
    exit 1
}

if (-not (Test-Path -Path $backendWatcher -PathType Leaf)) {
    Write-Error "未找到脚本：$backendWatcher"
    exit 1
}

if (-not (Test-Path -Path $tunnelWatcher -PathType Leaf)) {
    Write-Error "未找到脚本：$tunnelWatcher"
    exit 1
}

New-Item -ItemType Directory -Path $logsDir -Force | Out-Null

function Get-ChildProcesses {
    param([int]$ParentProcessId)

    Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $ParentProcessId }
}

function Stop-ProcessTree {
    param([int]$RootProcessId)

    for ($pass = 0; $pass -lt 3; $pass++) {
        $descendantEntries = New-Object System.Collections.Generic.List[object]
        $seen = New-Object 'System.Collections.Generic.HashSet[int]'
        $stack = New-Object System.Collections.Generic.Stack[object]
        $stack.Push([pscustomobject]@{ Pid = $RootProcessId; Depth = 0 })

        while ($stack.Count -gt 0) {
            $current = $stack.Pop()
            $currentPid = [int]$current.Pid
            $currentDepth = [int]$current.Depth

            foreach ($child in (Get-ChildProcesses -ParentProcessId $currentPid)) {
                $childPid = [int]$child.ProcessId
                if ($seen.Add($childPid)) {
                    $descendantEntries.Add([pscustomobject]@{ Pid = $childPid; Depth = $currentDepth + 1 })
                    $stack.Push([pscustomobject]@{ Pid = $childPid; Depth = $currentDepth + 1 })
                }
            }
        }

        $descendantPids = @(
            $descendantEntries |
                Sort-Object -Property @{ Expression = 'Depth'; Descending = $true }, @{ Expression = 'Pid'; Descending = $false } |
                Select-Object -ExpandProperty Pid
        )

        if ($descendantPids.Count -eq 0) {
            break
        }

        foreach ($descendantPid in $descendantPids) {
            try { Stop-Process -Id $descendantPid -Force -ErrorAction Stop } catch {}
        }

        Start-Sleep -Milliseconds 300
    }

    try { Stop-Process -Id $RootProcessId -Force -ErrorAction Stop } catch {}
}

$backendWatcherProcess = $null
$tunnelWatcherProcess = $null

try {
    $backendWatcherProcess = Start-Process -FilePath "powershell.exe" -WorkingDirectory $projectRoot -WindowStyle Normal -PassThru -ArgumentList @(
        "-NoProfile",
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-File", $backendWatcher,
        "-ProjectRoot", $projectRoot
    )

    $tunnelWatcherProcess = Start-Process -FilePath "powershell.exe" -WorkingDirectory $projectRoot -WindowStyle Normal -PassThru -ArgumentList @(
        "-NoProfile",
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-File", $tunnelWatcher,
        "-ProjectRoot", $projectRoot
    )

    [ordered]@{
        projectRoot = $projectRoot
        backendWatcher = [ordered]@{
            pid = $backendWatcherProcess.Id
            scriptPath = $backendWatcher
            processName = $backendWatcherProcess.ProcessName
        }
        tunnelWatcher = [ordered]@{
            pid = $tunnelWatcherProcess.Id
            scriptPath = $tunnelWatcher
            processName = $tunnelWatcherProcess.ProcessName
        }
        createdAt = (Get-Date).ToString("o")
    } | ConvertTo-Json -Depth 4 | Set-Content -Path $runtimePidFile -Encoding utf8
}
catch {
    if ($tunnelWatcherProcess) {
        Stop-ProcessTree -RootProcessId $tunnelWatcherProcess.Id
    }
    if ($backendWatcherProcess) {
        Stop-ProcessTree -RootProcessId $backendWatcherProcess.Id
    }

    Remove-Item -Path $runtimePidFile -Force -ErrorAction SilentlyContinue
    Write-Error "启动 watcher 或写入运行时 PID 文件失败：$($_.Exception.Message)"
    exit 1
}

Write-Host "已启动后端与隧道窗口。"
Write-Host "运行时 PID 文件：$runtimePidFile"
