# CPU atribuible a NUESTRO chrome (CommandLine ritmo-perfil) vs el resto.
param([int]$Segundos = 75)

$ErrorActionPreference = 'SilentlyContinue'
$out = Join-Path $PSScriptRoot 'perfil-cpu.log'
$err = Join-Path $PSScriptRoot 'perfil-cpu.err'
Remove-Item $out, $err -ErrorAction SilentlyContinue

$node = Start-Process -FilePath 'node' -ArgumentList 'scripts\export-profile.mjs' `
  -WorkingDirectory (Split-Path $PSScriptRoot -Parent) `
  -RedirectStandardOutput $out -RedirectStandardError $err `
  -WindowStyle Hidden -PassThru

function Medir {
  $nuestros = @(); $otrosChrome = 0.0; $otrosNode = 0.0
  Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='node.exe'" | ForEach-Object {
    $cpu = 0.0
    try { $p = Get-Process -Id $_.ProcessId -ErrorAction Stop; if ($p.CPU) { $cpu = $p.CPU } } catch {}
    if ($_.CommandLine -match 'ritmo-perfil') {
      $nuestros += [pscustomobject]@{ PID = $_.ProcessId; CPU = [math]::Round($cpu, 1) }
    } elseif ($_.Name -eq 'chrome.exe') { $otrosChrome += $cpu }
    elseif ($_.Name -eq 'node.exe') { $otrosNode += $cpu }
  }
  [pscustomobject]@{ Nuestros = $nuestros; OtrosChrome = [math]::Round($otrosChrome, 1); OtrosNode = [math]::Round($otrosNode, 1) }
}

$prev = $null
for ($t = 0; $t -lt $Segundos; $t += 5) {
  Start-Sleep -Seconds 5
  $m = Medir
  $sumaN = [math]::Round(($m.Nuestros | Measure-Object CPU -Sum).Sum, 1)
  if ($null -eq $prev) {
    Write-Output ('t+{0,3}s  nuestro_chrome={1}s (procs={2})  otros_chrome={3}s  otros_node={4}s' -f ($t+5), $sumaN, $m.Nuestros.Count, $m.OtrosChrome, $m.OtrosNode)
  } else {
    $dN = [math]::Round($sumaN - $prev.SumaN, 1)
    $dO = [math]::Round($m.OtrosChrome - $prev.OtrosChrome, 1)
    $dNode = [math]::Round($m.OtrosNode - $prev.OtrosNode, 1)
    Write-Output ('t+{0,3}s  NUESTRO chrome: +{1}s CPU/5s ({2} procs) | otros chrome: +{3}s | otros node: +{4}s' -f ($t+5), $dN, $m.Nuestros.Count, $dO, $dNode)
    Write-Output ('         -> por PID: ' + (($m.Nuestros | Sort-Object CPU -Descending | ForEach-Object { 'pid {0}={1}s' -f $_.PID, $_.CPU }) -join ', '))
  }
  $prev = [pscustomobject]@{ SumaN = $sumaN; OtrosChrome = $m.OtrosChrome; OtrosNode = $m.OtrosNode }
}

if (-not $node.HasExited) { Stop-Process -Id $node.Id -Force }
Start-Sleep -Seconds 1
Write-Output '--- stdout nodo ---'
if (Test-Path $out) { Get-Content $out -Encoding UTF8 | Select-Object -Last 30 }
if (Test-Path $err) { Write-Output '--- stderr ---'; Get-Content $err -Encoding UTF8 | Select-Object -Last 8 }
