# Bake missile/boom WAVs from Kenney Sci-Fi Sounds (CC0).
# Requires: ffmpeg on PATH or Winget Gyan.FFmpeg package.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "assets\audio"
$tmp = Join-Path $PSScriptRoot "_sfx_tmp"
$zip = Join-Path $tmp "pack.zip"
$audioDir = Join-Path $tmp "pack\Audio"

$ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $ffmpeg) {
  $ffmpeg = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Gyan.FFmpeg*" -Recurse -Filter "ffmpeg.exe" -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $ffmpeg) { throw "ffmpeg not found" }

New-Item -ItemType Directory -Force -Path $tmp, $out | Out-Null
if (-not (Test-Path $audioDir)) {
  Invoke-WebRequest -Uri "https://opengameart.org/sites/default/files/sci-fi_sounds.zip" -OutFile $zip
  Expand-Archive -Path $zip -DestinationPath (Join-Path $tmp "pack") -Force
}

& $ffmpeg -y -i "$audioDir\thrusterFire_003.ogg" -i "$audioDir\impactMetal_001.ogg" `
  -filter_complex "[1:a]volume=0.5[m];[0:a]atrim=0:1.05,asetpts=PTS-STARTPTS,volume=1.2[t];[t][m]amix=inputs=2:duration=first:dropout_transition=0,afade=t=in:st=0:d=0.015,afade=t=out:st=0.7:d=0.35,loudnorm=I=-14:TP=-1.5:LRA=8" `
  -ar 44100 -ac 1 "$out\missile.wav"

& $ffmpeg -y -i "$audioDir\explosionCrunch_004.ogg" -i "$audioDir\lowFrequency_explosion_000.ogg" -i "$audioDir\explosionCrunch_001.ogg" `
  -filter_complex "[0:a]volume=1.0[a0];[1:a]volume=1.35[a1];[2:a]volume=0.55,adelay=40|40[a2];[a0][a1][a2]amix=inputs=3:duration=longest:dropout_transition=0,afade=t=out:st=1.6:d=0.5,loudnorm=I=-12:TP=-1.0:LRA=10" `
  -ar 44100 -ac 1 "$out\boom.wav"

& $ffmpeg -y -i "$audioDir\lowFrequency_explosion_000.ogg" -i "$audioDir\explosionCrunch_002.ogg" -i "$audioDir\slime_000.ogg" `
  -filter_complex "[0:a]volume=1.4[a0];[1:a]volume=0.7[a1];[2:a]volume=0.85,adelay=20|20[a2];[a0][a1][a2]amix=inputs=3:duration=longest:dropout_transition=0,afade=t=out:st=1.4:d=0.45,loudnorm=I=-12:TP=-1.0:LRA=10" `
  -ar 44100 -ac 1 "$out\boom_water.wav"

Write-Output "baked missile.wav, boom.wav, boom_water.wav"
