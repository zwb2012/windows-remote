param()

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$logsDir = Join-Path $projectRoot "logs"
$runtimePidFile = Join-Path $logsDir "runtime-pids.json"

if (-not (Test-Path -Path $runtimePidFile -PathType Leaf)) {
    Write-Error "未找到运行时 PID 文件：$runtimePidFile。请先通过 scripts/start-remote.bat 或 scripts/start-remote.ps1 启动。"
    exit 1
}

try {
    $runtime = Get-Content -Path $runtimePidFile -Raw | ConvertFrom-Json
}
catch {
    Write-Error "读取运行时 PID 文件失败：$runtimePidFile。$($_.Exception.Message)"
    exit 1
}

$watchers = @()
if ($runtime.backendWatcher) { $watchers += $runtime.backendWatcher }
if ($runtime.tunnelWatcher) { $watchers += $runtime.tunnelWatcher }

if ($watchers.Count -eq 0) {
    Write-Error "运行时 PID 文件中没有可用的 watcher 信息：$runtimePidFile"
    exit 1
}

function Get-ChildProcesses {
    param([int]$ParentProcessId)

    Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $ParentProcessId }
}

function Get-ValidatedWatcherProcess {
    param([object]$Watcher)

    if (-not $Watcher.pid -or -not $Watcher.scriptPath -or -not $Watcher.processName) {
        return $null
    }

    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($Watcher.pid)" -ErrorAction SilentlyContinue
    if (-not $process) {
        return $null
    }

    if ($process.Name -ne ($Watcher.processName + ".exe") -and $process.Name -ne $Watcher.processName) {
        return $null
    }

    $escapedScriptPath = [regex]::Escape([string]$Watcher.scriptPath)
    if ($process.CommandLine -notmatch $escapedScriptPath) {
        return $null
    }

    return $process
}

function Get-DescendantPids {
    param([int]$RootProcessId)

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

    @(
        $descendantEntries |
            Sort-Object -Property @{ Expression = 'Depth'; Descending = $true }, @{ Expression = 'Pid'; Descending = $false } |
            Select-Object -ExpandProperty Pid
    )
}

foreach ($watcher in $watchers) {
    $validatedWatcher = Get-ValidatedWatcherProcess -Watcher $watcher
    if (-not $validatedWatcher) {
        Write-Warning "watcher PID=$($watcher.pid) 与运行时记录不匹配，已跳过，避免误杀其他进程。"
        continue
    }

    for ($pass = 0; $pass -lt 3; $pass++) {
        $descendantPids = Get-DescendantPids -RootProcessId $validatedWatcher.ProcessId
        if ($descendantPids.Count -eq 0) {
            break
        }

        foreach ($descendantPid in $descendantPids) {
            try {
                Stop-Process -Id $descendantPid -Force -ErrorAction Stop
                Write-Host "已停止子进程 PID=$descendantPid"
            }
            catch [System.ArgumentException] {
                Write-Host "子进程 PID=$descendantPid 已退出"
            }
            catch {
                Write-Warning "停止子进程 PID=$descendantPid 失败：$($_.Exception.Message)"
            }
        }

        Start-Sleep -Milliseconds 300
    }

    try {
        Stop-Process -Id $validatedWatcher.ProcessId -Force -ErrorAction Stop
        Write-Host "已停止 watcher PID=$($validatedWatcher.ProcessId)"
    }
    catch [System.ArgumentException] {
        Write-Host "watcher PID=$($validatedWatcher.ProcessId) 已退出"
    }
    catch {
        Write-Warning "停止 watcher PID=$($validatedWatcher.ProcessId) 失败：$($_.Exception.Message)"
    }
}

Remove-Item -Path $runtimePidFile -Force
Write-Host "已删除运行时 PID 文件：$runtimePidFile"
Write-Host "停止完成。"
