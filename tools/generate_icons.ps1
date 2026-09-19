Add-Type -AssemblyName System.Drawing

$srcPath = Resolve-Path "public\images\basetrack-logo.png"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

# 1. Analizar bounding box del isotipo (símbolo de la piocha + montaña + flecha)
# El isotipo está en la mitad superior (y < 380)
$iconMinX = $src.Width; $iconMaxX = 0; $iconMinY = $src.Height; $iconMaxY = 0
# El logo completo (incluyendo texto "BASETRACK")
$fullMinX = $src.Width; $fullMaxX = 0; $fullMinY = $src.Height; $fullMaxY = 0

for ($y = 0; $y -lt $src.Height; $y += 2) {
    for ($x = 0; $x -lt $src.Width; $x += 2) {
        $pixel = $src.GetPixel($x, $y)
        # Pixel no blanco si R o G o B es menor a 240
        if ($pixel.R -lt 238 -or $pixel.G -lt 238 -or $pixel.B -lt 238) {
            if ($x -lt $fullMinX) { $fullMinX = $x }
            if ($x -gt $fullMaxX) { $fullMaxX = $x }
            if ($y -lt $fullMinY) { $fullMinY = $y }
            if ($y -gt $fullMaxY) { $fullMaxY = $y }

            # Isotipo está arriba de y = 370
            if ($y -lt 370) {
                if ($x -lt $iconMinX) { $iconMinX = $x }
                if ($x -gt $iconMaxX) { $iconMaxX = $x }
                if ($y -lt $iconMinY) { $iconMinY = $y }
                if ($y -gt $iconMaxY) { $iconMaxY = $y }
            }
        }
    }
}

Write-Host "Full Logo Bounds: X=[$fullMinX, $fullMaxX] Y=[$fullMinY, $fullMaxY]"
Write-Host "Icon Bounds: X=[$iconMinX, $iconMaxX] Y=[$iconMinY, $iconMaxY]"

# Margen de seguridad
$pad = 16
$iconW = ($iconMaxX - $iconMinX) + ($pad * 2)
$iconH = ($iconMaxY - $iconMinY) + ($pad * 2)
$iconSize = [Math]::Max($iconW, $iconH)

$iconStartX = [Math]::Max(0, [int]($iconMinX - $pad - ($iconSize - $iconW)/2))
$iconStartY = [Math]::Max(0, [int]($iconMinY - $pad - ($iconSize - $iconH)/2))

# 2. Generar el Isotipo Cuadrado (Icono transparente/blanco de alta calidad)
$iconBmp = New-Object System.Drawing.Bitmap $iconSize, $iconSize
$gIcon = [System.Drawing.Graphics]::FromImage($iconBmp)
$gIcon.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gIcon.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gIcon.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$gIcon.Clear([System.Drawing.Color]::Transparent)

$srcRect = New-Object System.Drawing.Rectangle $iconStartX, $iconStartY, $iconSize, $iconSize
$destRect = New-Object System.Drawing.Rectangle 0, 0, $iconSize, $iconSize
$gIcon.DrawImage($src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$gIcon.Dispose()

# Guardar Icono 512x512 y 192x192
function Save-ResizedIcon($sourceBmp, $targetSize, $targetPath) {
    $resized = New-Object System.Drawing.Bitmap $targetSize, $targetSize
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($sourceBmp, (New-Object System.Drawing.Rectangle 0, 0, $targetSize, $targetSize))
    $g.Dispose()
    $resized.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $resized.Dispose()
    Write-Host "Generado: $targetPath ($targetSize x $targetSize)"
}

Save-ResizedIcon $iconBmp 512 "public\icons\icon-512.png"
Save-ResizedIcon $iconBmp 192 "public\icons\icon-192.png"
Save-ResizedIcon $iconBmp 512 "public\icons\icon-maskable-512.png"
Save-ResizedIcon $iconBmp 192 "public\icons\icon-maskable-192.png"
Save-ResizedIcon $iconBmp 256 "public\images\basetrack-icon.png"
Save-ResizedIcon $iconBmp 64  "public\favicon.ico"

# 3. Generar el Logotipo Completo Recortado (Horizontal, limpio sin bordes vacíos gigantes)
$logoPad = 24
$logoX = [Math]::Max(0, $fullMinX - $logoPad)
$logoY = [Math]::Max(0, $fullMinY - $logoPad)
$logoW = [Math]::Min($src.Width - $logoX, ($fullMaxX - $fullMinX) + ($logoPad * 2))
$logoH = [Math]::Min($src.Height - $logoY, ($fullMaxY - $fullMinY) + ($logoPad * 2))

$cropLogo = New-Object System.Drawing.Bitmap $logoW, $logoH
$gLogo = [System.Drawing.Graphics]::FromImage($cropLogo)
$gLogo.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gLogo.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gLogo.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$gLogo.Clear([System.Drawing.Color]::White)
$gLogo.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $logoW, $logoH), (New-Object System.Drawing.Rectangle $logoX, $logoY, $logoW, $logoH), [System.Drawing.GraphicsUnit]::Pixel)
$gLogo.Dispose()

$cropLogo.Save("public\images\basetrack-logo-clean.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Generado: public\images\basetrack-logo-clean.png ($logoW x $logoH)"

$cropLogo.Dispose()
$iconBmp.Dispose()
$src.Dispose()
