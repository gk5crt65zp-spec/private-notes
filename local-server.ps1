$ErrorActionPreference = "Stop"
# Local LAN web server - ASCII only (no internet needed)
# v2: read timeouts so one stuck client cannot hang the server
$port = 8080
$root = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$htmlFiles = @(Get-ChildItem -Path $root -Filter *.html | Where-Object { $_.Name -notlike "serve*" })
$cfg = Join-Path $root "page.txt"
if ([IO.File]::Exists($cfg)) {
  $defaultPage = (Get-Content -Path $cfg -Encoding UTF8 -First 1).Trim()
  if (-not [IO.File]::Exists((Join-Path $root $defaultPage))) { $defaultPage = "" }
}
if ([string]::IsNullOrEmpty($defaultPage)) {
  if ($htmlFiles.Count -eq 0) { Write-Host "ERROR: no html file found"; exit 1 }
  $defaultPage = ($htmlFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1).Name
}

# Free the port if something is already listening there
Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.OwningProcess -and (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName -match "powershell|pwsh" } |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 400

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $port)
$listener.Start()
Write-Host "SERVER-READY port=$port default=$defaultPage"

while ($true) {
  try {
    $client = $listener.AcceptTcpClient()
  } catch { Start-Sleep -Milliseconds 200; continue }
  try {
    $client.ReceiveTimeout = 5000
    $client.SendTimeout = 5000
    try { $remoteEP = $client.Client.RemoteEndPoint; Write-Output ("CONN " + (Get-Date -Format 'HH:mm:ss') + " from " + $remoteEP.ToString()) } catch { }
    $stream = $client.GetStream()
    $stream.ReadTimeout = 5000
    $stream.WriteTimeout = 5000
    $buffer = New-Object byte[] 8192
    $len = $stream.Read($buffer, 0, 8192)
    if ($len -gt 0) {
      $req = [Text.Encoding]::ASCII.GetString($buffer, 0, $len)
      $line = ($req -split "`r?`n")[0]
      $parts = $line -split " "
      $method = if ($parts.Length -gt 0) { $parts[0] } else { "" }
      $path   = if ($parts.Length -gt 1) { $parts[1] } else { "/" }

      if ($method -eq "GET" -or $method -eq "HEAD") {
        $rel = [Uri]::UnescapeDataString(($path -split "\?")[0]).Trim('/')
        if ([string]::IsNullOrWhiteSpace($rel)) { $rel = $defaultPage }
        $safe = $rel -replace '[\\/:*?"<>|]', '_'
        $full = Join-Path $root $safe
        $ok = $false
        if ([IO.File]::Exists($full)) {
          $bytes = [IO.File]::ReadAllBytes($full); $ok = $true
        } else {
          $full = Join-Path $root $defaultPage
          if ([IO.File]::Exists($full)) { $bytes = [IO.File]::ReadAllBytes($full); $ok = $true }
        }

        if ($ok) {
          $ext = [IO.Path]::GetExtension($full).ToLower()
          $ctype = switch ($ext) { ".html" {"text/html; charset=utf-8"} ".css" {"text/css; charset=utf-8"} ".js" {"text/javascript; charset=utf-8"} ".png" {"image/png"} ".jpg" {"image/jpeg"} ".svg" {"image/svg+xml"} default {"application/octet-stream"} }
          $hdr = "HTTP/1.1 200 OK`r`nContent-Type: $ctype`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
        } else {
          $bytes = [Text.Encoding]::UTF8.GetBytes("<h1>404</h1>")
          $hdr = "HTTP/1.1 404 Not Found`r`nContent-Type: text/html; charset=utf-8`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
        }
        $hb = [Text.Encoding]::ASCII.GetBytes($hdr)
        $stream.Write($hb, 0, $hb.Length)
        if ($method -eq "GET") { $stream.Write($bytes, 0, $bytes.Length) }
        $stream.Flush()
        Write-Output ("REQ " + (Get-Date -Format 'HH:mm:ss') + " " + $method + " " + $path)
      }
    }
  } catch { Write-Output ("ERR " + (Get-Date -Format 'HH:mm:ss') + " " + $_.Exception.Message) }
  finally { try { $client.Close() } catch { } }
}
