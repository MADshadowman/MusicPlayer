$ErrorActionPreference = "Stop"
$root = "C:\Users\Admin\Documents\MusicPlayer"

# byte patterns: mojibake (double-encoded UTF-8) -> proper UTF-8
$mappings = @(
  @{ name = "leftArrow";  from = @(0xC3,0xA2,0xC2,0x86,0xC2,0x90); to = @(0xE2,0x86,0x90) }
  @{ name = "rightArrow"; from = @(0xC3,0xA2,0xC2,0x86,0xC2,0x92); to = @(0xE2,0x86,0x92) }
  @{ name = "upArrow";    from = @(0xC3,0xA2,0xC2,0x86,0xC2,0x91); to = @(0xE2,0x86,0x91) }
  @{ name = "downArrow";  from = @(0xC3,0xA2,0xC2,0x86,0xC2,0x93); to = @(0xE2,0x86,0x93) }
  @{ name = "plusMinus";  from = @(0xC3,0x82,0xC2,0xB1);           to = @(0xC2,0xB1) }
  @{ name = "emDash";     from = @(0xC3,0xA2,0xC2,0x80,0xC2,0x94); to = @(0xE2,0x80,0x94) }
  @{ name = "enDash";     from = @(0xC3,0xA2,0xC2,0x80,0xC2,0x93); to = @(0xE2,0x80,0x93) }
  @{ name = "ellipsis";   from = @(0xC3,0xA2,0xC2,0x80,0xC2,0xA6); to = @(0xE2,0x80,0xA6) }
  @{ name = "curlyQO";    from = @(0xC3,0xA2,0xC2,0x80,0xC2,0x9C); to = @(0x22) }
  @{ name = "curlyQC";    from = @(0xC3,0xA2,0xC2,0x80,0xC2,0x9D); to = @(0x22) }
  @{ name = "curlySO";    from = @(0xC3,0xA2,0xC2,0x80,0xC2,0x98); to = @(0x27) }
  @{ name = "curlySC";    from = @(0xC3,0xA2,0xC2,0x80,0xC2,0x99); to = @(0x27) }
)

$files = Get-ChildItem $root -File | Where-Object {
  $_.Extension -in ".html",".js",".css",".md",".webmanifest"
}

foreach ($file in $files) {
  $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
  $changed = $false
  foreach ($m in $mappings) {
    $needle = [byte[]]$m.from
    $head = 0
    while ($true) {
      $i = -1
      for ($b = $head; $b -le $bytes.Length - $needle.Length; $b++) {
        $ok = $true
        for ($k = 0; $k -lt $needle.Length; $k++) {
          if ($bytes[$b + $k] -ne $needle[$k]) { $ok = $false; break }
        }
        if ($ok) { $i = $b; break }
      }
      if ($i -lt 0) { break }
      $tail = $bytes[($i + $needle.Length)..($bytes.Length - 1)]
      $bytes = $bytes[0..($i - 1)] + [byte[]]$m.to + $tail
      $head = $i + $m.to.Length
      $changed = $true
    }
  }
  if ($changed) {
    [System.IO.File]::WriteAllBytes($file.FullName, [byte[]]$bytes)
    Write-Output "fixed: $($file.Name)"
  }
  else {
    Write-Output "clean : $($file.Name)"
  }
}
