# ==========================================
# Local Development Server
# ==========================================
# Usage: .\serve.ps1
# This starts a simple HTTP server on port 8080

$port = 8080
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "  ================================" -ForegroundColor Cyan
Write-Host "   PM Mold RTE - Dev Server" -ForegroundColor White
Write-Host "  ================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Local:  " -NoNewline -ForegroundColor Gray
Write-Host "http://localhost:$port" -ForegroundColor Green
Write-Host "  Root:   $root" -ForegroundColor Gray
Write-Host ""
Write-Host "  Press Ctrl+C to stop" -ForegroundColor DarkGray
Write-Host ""

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:${port}/")
$listener.Start()

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
    ".ttf"  = "font/ttf"
    ".webp" = "image/webp"
    ".mp4"  = "video/mp4"
    ".sql"  = "text/plain; charset=utf-8"
    ".md"   = "text/markdown; charset=utf-8"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/") { $urlPath = "/index.html" }

        # Remove query string for file lookup
        $cleanPath = ($urlPath -split '\?')[0]
        $filePath = Join-Path $root ($cleanPath -replace '/', '\')

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }

            $content = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $contentType
            $response.ContentLength64 = $content.Length

            # CORS headers for local development
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Cache-Control", "no-cache")

            $response.OutputStream.Write($content, 0, $content.Length)

            Write-Host "  $(Get-Date -Format 'HH:mm:ss') " -NoNewline -ForegroundColor DarkGray
            Write-Host "200 " -NoNewline -ForegroundColor Green
            Write-Host "$urlPath" -ForegroundColor White
        } else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
            $response.ContentType = "text/plain; charset=utf-8"
            $response.ContentLength64 = $msg.Length
            $response.OutputStream.Write($msg, 0, $msg.Length)

            Write-Host "  $(Get-Date -Format 'HH:mm:ss') " -NoNewline -ForegroundColor DarkGray
            Write-Host "404 " -NoNewline -ForegroundColor Red
            Write-Host "$urlPath" -ForegroundColor DarkGray
        }

        $response.OutputStream.Close()
    }
} finally {
    $listener.Stop()
    Write-Host "`n  Server stopped." -ForegroundColor Yellow
}
