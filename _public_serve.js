const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8870;
const DIR = __dirname;
const CF_BIN = 'C:\\Users\\Administrator\\cloudflared.exe';
const RESULTS_FILE = path.join(DIR, '_q3_public_results.json');

// MIME types
const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
};

// Kill existing server on port
const existing = require('child_process').execSync(
  `netstat -ano | findstr :${PORT}`, { encoding: 'utf8', timeout: 3000 }
).match(/LISTENING\s+(\d+)/);
if (existing) {
  try { process.kill(parseInt(existing[1]), 'SIGTERM'); } catch(e) {}
  console.log(`Killed existing PID ${existing[1]} on :${PORT}`);
  require('child_process').execSync('timeout /t 2 /nobreak >nul', { shell: true });
}

let diagResults = [];

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Permissions-Policy', 'xr-spatial-tracking=(*)');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // POST /diag_result — capture Quest 3 diagnostic results
  if (req.method === 'POST' && req.url === '/diag_result') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        data._receivedAt = new Date().toISOString();
        data._remoteIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        diagResults.push(data);
        fs.writeFileSync(RESULTS_FILE, JSON.stringify(diagResults, null, 2));
        console.log(`\n${'='.repeat(60)}`);
        console.log(`  QUEST 3 DIAGNOSTIC RESULTS RECEIVED!`);
        console.log(`  Pass: ${data.pass}  Fail: ${data.fail}  Warn: ${data.warn}`);
        console.log(`  UA: ${(data.ua || '').slice(0, 80)}`);
        if (data.errors?.length) console.log(`  Errors: ${data.errors.join(', ')}`);
        console.log(`${'='.repeat(60)}\n`);
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end('{"ok":true}');
      } catch(e) {
        res.writeHead(400); res.end('{"error":"parse"}');
      }
    });
    return;
  }

  // GET /diag_status — check if results arrived
  if (req.url === '/diag_status') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ count: diagResults.length, results: diagResults }));
    return;
  }

  // Static file serving
  let filePath = path.join(DIR, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('404'); return; }
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);
  res.writeHead(200, {'Content-Type': mime + (mime.startsWith('text') ? '; charset=UTF-8' : '')});
  res.end(content);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Static server: http://localhost:${PORT}`);
  console.log(`  Serving: ${DIR}\n`);

  // Start cloudflared tunnel
  console.log('  Starting Cloudflare tunnel...\n');
  const cf = spawn(CF_BIN, ['tunnel', '--url', `http://localhost:${PORT}`, '--no-autoupdate'], {
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  });

  let tunnelUrl = '';
  function onCfData(data) {
    const line = data.toString();
    process.stderr.write(line);
    const m = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m && !tunnelUrl) {
      tunnelUrl = m[0];
      fs.writeFileSync('C:\\Users\\Administrator\\tunnel_url.txt', tunnelUrl);
      console.log(`\n${'*'.repeat(60)}`);
      console.log(`  TUNNEL READY: ${tunnelUrl}`);
      console.log(`  Quest 3 diag: ${tunnelUrl}/_q3_diag.html`);
      console.log(`  Main app:     ${tunnelUrl}/index.html`);
      console.log(`  Xianxia:      ${tunnelUrl}/xianxia_worldlabs.html`);
      console.log(`${'*'.repeat(60)}\n`);
    }
  }
  cf.stdout.on('data', onCfData);
  cf.stderr.on('data', onCfData);
  cf.on('error', e => console.error('cloudflared error:', e.message));
  cf.on('close', code => { console.log('cloudflared exited:', code); process.exit(1); });
});

process.on('SIGINT', () => { console.log('Shutting down...'); process.exit(0); });
