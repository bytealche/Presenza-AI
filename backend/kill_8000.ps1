$port = 8000
$tcpConns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($tcpConns) {
    foreach ($conn in $tcpConns) {
        $pidToKill = $conn.OwningProcess
        if ($pidToKill) {
            Write-Host "Killing PID $pidToKill"
            Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
        }
    }
}
Write-Host "Done"
