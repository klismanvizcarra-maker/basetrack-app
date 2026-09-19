Add-Type -AssemblyName System.Drawing

function Make-Transparent($srcPath, $dstPath) {
    $src = [System.Drawing.Bitmap]::FromFile($srcPath)
    $dst = New-Object System.Drawing.Bitmap $src.Width, $src.Height
    
    for ($y = 0; $y -lt $src.Height; $y++) {
        for ($x = 0; $x -lt $src.Width; $x++) {
            $p = $src.GetPixel($x, $y)
            # Si el pixel es muy claro (casi blanco del fondo original)
            if ($p.R -gt 240 -and $p.G -gt 240 -and $p.B -gt 240) {
                $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
            } else {
                # Para suavizar bordes (anti-aliasing)
                $brightness = ($p.R + $p.G + $p.B) / 3.0
                if ($brightness -gt 215) {
                    $alpha = [Math]::Max(0, [Math]::Min(255, [int]((255 - $brightness) / 40.0 * 255)))
                    $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $p.R, $p.G, $p.B))
                } else {
                    $dst.SetPixel($x, $y, $p)
                }
            }
        }
    }
    
    $dst.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $src.Dispose()
    $dst.Dispose()
    Write-Host "Generado transparente: $dstPath"
}

Make-Transparent "public\images\basetrack-icon.png" "public\images\basetrack-icon-transparent.png"
Make-Transparent "public\images\basetrack-logo-clean.png" "public\images\basetrack-logo-transparent.png"

# También actualizar icon-192 y icon-512 con la versión transparente limpia
Copy-Item "public\images\basetrack-icon-transparent.png" "public\icons\icon-192.png" -Force
Copy-Item "public\images\basetrack-icon-transparent.png" "public\icons\icon-512.png" -Force
