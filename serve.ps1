# Tiny local web server for Prism Puff (no install, no admin needed).
# Browsers block the game's code when index.html is opened as a file, so we serve it on
# http://localhost instead. Started by start-game.bat; close the window to stop it.
param([int]$Port = 8000)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'; '.svg' = 'image/svg+xml'; '.wasm' = 'application/wasm'; '.ico' = 'image/x-icon'
}

# Find a free port starting at $Port.
$listener = $null
for ($p = $Port; $p -lt $Port + 20; $p++) {
  try { $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $p); $listener.Start(); $Port = $p; break }
  catch { $listener = $null }
}
if (-not $listener) { Write-Host 'Could not find a free port.'; Read-Host 'Press Enter to close'; exit 1 }

$url = "http://localhost:$Port/"
Write-Host ''
Write-Host "  Prism Puff is running at $url" -ForegroundColor Magenta
Write-Host '  Keep this window open while you play. Close it to stop.'
Write-Host ''
Start-Process $url

while ($true) {
  $client = $listener.AcceptTcpClient()
  $client.ReceiveTimeout = 2000  # drop idle preconnect sockets instead of hanging
  try {
    $stream = $client.GetStream()
    $reader = [System.IO.StreamReader]::new($stream)
    $line = $reader.ReadLine()
    while (($h = $reader.ReadLine()) -ne $null -and $h -ne '') { }  # skip headers
    if (-not $line) { continue }
    $path = ($line -split ' ')[1]
    $path = [System.Uri]::UnescapeDataString(($path -split '\?')[0])
    if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }
    $file = [System.IO.Path]::GetFullPath((Join-Path $root $path.TrimStart('/')))
    if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
      $body = [System.IO.File]::ReadAllBytes($file)
      $type = $types[[System.IO.Path]::GetExtension($file).ToLower()]
      if (-not $type) { $type = 'application/octet-stream' }
      $status = '200 OK'
    } else {
      $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
      $type = 'text/plain'
      $status = '404 Not Found'
    }
    $head = "HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
    $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($hb, 0, $hb.Length)
    $stream.Write($body, 0, $body.Length)
    $stream.Flush()
  } catch { } finally { $client.Close() }
}
