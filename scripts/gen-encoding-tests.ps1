$srcFile = Get-ChildItem -Path 'D:\own\cuyoai\sweet-subtitle' -Recurse -Filter 'encoding_base_utf8.srt' | Select-Object -First 1
if (-not $srcFile) {
  throw 'encoding_base_utf8.srt not found'
}

$src = $srcFile.FullName
$outDir = $srcFile.DirectoryName
$text = [System.IO.File]::ReadAllText($src, [System.Text.Encoding]::UTF8)

function Write-WithBom($path, $enc) {
  $bytes = $enc.GetPreamble() + $enc.GetBytes($text)
  [System.IO.File]::WriteAllBytes($path, $bytes)
}

function Write-NoBom($path, $enc) {
  $bytes = $enc.GetBytes($text)
  [System.IO.File]::WriteAllBytes($path, $bytes)
}

Write-WithBom (Join-Path $outDir 'encoding_utf16le_bom.srt') ([System.Text.Encoding]::Unicode)
Write-NoBom   (Join-Path $outDir 'encoding_utf16le_nobom.srt') ([System.Text.Encoding]::Unicode)
Write-WithBom (Join-Path $outDir 'encoding_utf16be_bom.srt') ([System.Text.Encoding]::BigEndianUnicode)
Write-NoBom   (Join-Path $outDir 'encoding_utf16be_nobom.srt') ([System.Text.Encoding]::BigEndianUnicode)
Write-NoBom   (Join-Path $outDir 'encoding_gbk.srt') ([System.Text.Encoding]::GetEncoding(936))
Write-NoBom   (Join-Path $outDir 'encoding_big5.srt') ([System.Text.Encoding]::GetEncoding(950))
Write-NoBom   (Join-Path $outDir 'encoding_shift_jis.srt') ([System.Text.Encoding]::GetEncoding(932))

Write-Host $outDir
