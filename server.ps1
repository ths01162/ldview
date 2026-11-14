# 치지직 라두스 고로시 웹앱 로컬 서버 & CORS 프록시 (별도 설치 불필요)
param(
  [int]$Port = 8080
)

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 🚨 라두스 고로시 박제소 로컬 서버 & CHZZK CORS 프록시 가동!" -ForegroundColor Green
Write-Host " 👉 브라우저 접속 주소: $prefix" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $req = $context.Request
    $res = $context.Response
    $res.Headers.Add("Access-Control-Allow-Origin", "*")

    $path = $req.Url.LocalPath

    # 치지직 API 실시간 CORS 프록시 엔드포인트
    if ($path -eq "/api/proxy") {
      $targetUrl = $req.QueryString["url"]
      if ($targetUrl -and $targetUrl.StartsWith("https://api.chzzk.naver.com/")) {
        try {
          $apiResp = Invoke-WebRequest -Uri $targetUrl -Headers @{"User-Agent"="Mozilla/5.0"} -UseBasicParsing
          $bytes = $apiResp.RawContentStream.ToArray()
          $res.ContentType = "application/json; charset=utf-8"
          $res.StatusCode = 200
          $res.ContentLength64 = $bytes.Length
          $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } catch {
          $errBytes = [System.Text.Encoding]::UTF8.GetBytes("{`"code`":500,`"message`":`"Proxy error`"}")
          $res.ContentType = "application/json; charset=utf-8"
          $res.StatusCode = 502
          $res.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
      } else {
        $res.StatusCode = 400
      }
      $res.OutputStream.Close()
      continue
    }

    if ($path -eq "/") { $path = "/index.html" }
    $localFile = Join-Path $PSScriptRoot ($path.TrimStart('/').Replace('/', '\'))

    if (Test-Path $localFile -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($localFile).ToLower()
      $res.ContentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
      $fileBytes = [System.IO.File]::ReadAllBytes($localFile)
      $res.StatusCode = 200
      $res.ContentLength64 = $fileBytes.Length
      $res.OutputStream.Write($fileBytes, 0, $fileBytes.Length)
    } else {
      $res.StatusCode = 404
    }
    $res.OutputStream.Close()
  }
} finally {
  $listener.Stop()
}
