$base = 'https://zhouyoukang.github.io/vr-xianxia-jianzhen'
$pages = @('index.html','xianxia_worldlabs.html','_q3_diag.html','_q3_beacon.html')
Write-Host "=== GitHub Pages reachability ($base) ==="
foreach ($p in $pages) {
    $u = "$base/$p"
    try {
        $r = Invoke-WebRequest -Uri $u -Method Head -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        $len = $r.Headers['Content-Length']
        $mt = $r.Headers['Last-Modified']
        Write-Host ("OK  $p HTTP=$($r.StatusCode) len=$len mtime=$mt")
    } catch {
        Write-Host ("FAIL $p  err=$($_.Exception.Message)")
    }
}
Write-Host ""
Write-Host "=== dt-fix content verification (raw GitHub) ==="
$raw = 'https://raw.githubusercontent.com/zhouyoukang/vr-xianxia-jianzhen/main'
foreach ($f in @('index.html','xianxia_worldlabs.html')) {
    try {
        $c = (Invoke-WebRequest -Uri "$raw/$f" -UseBasicParsing -TimeoutSec 15).Content
        $hit = ([regex]'Math\.min\(dt,\s*0\.1\)').Matches($c).Count
        $sz = $c.Length
        Write-Host ("$f : size=$sz dt_cap_hits=$hit")
    } catch {
        Write-Host ("$f : FAIL $($_.Exception.Message)")
    }
}
