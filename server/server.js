// run.sh 용 로컬 서버: QE Analog Topology 화면을 내보내고 실제 OS 를 /api 로 연결한다.
// 127.0.0.1 에서만 열고, 시작할 때 만든 토큰이 없으면 /api 를 거부한다.
// (/api/exec 는 셸 명령을 실행하므로 다른 웹사이트가 호출할 수 없어야 한다.)
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const api = require('../app/os-api.js');

const ROOT = path.resolve(__dirname, '..');
const TOKEN = crypto.randomBytes(16).toString('hex');
const STATIC = ['/index.html', '/src/', '/assets/', '/node_modules/three/'];
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};

let port = Number(process.env.PORT) || 8000;

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1 << 20) throw new Error('too large');
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : [];
}

async function handleApi(req, res, name) {
  if (req.method !== 'POST' || req.headers['x-topology-token'] !== TOKEN) return send(res, 403, 'forbidden');
  if (name === 'quit') {
    send(res, 200, 'null', TYPES['.json']);
    server.close(() => process.exit(0));
    return;
  }
  if (!Object.hasOwn(api, name)) return send(res, 404, 'unknown api');
  try {
    const args = await readBody(req);
    const result = await api[name](...(Array.isArray(args) ? args : []));
    send(res, 200, JSON.stringify(result ?? null), TYPES['.json']);
  } catch (err) {
    send(res, 500, err.message);
  }
}

async function handleStatic(res, pathname) {
  let p = pathname === '/' ? '/index.html' : pathname;
  if (p === '/favicon.ico') p = '/assets/icon.svg';
  if (!STATIC.some((s) => p === s || (s.endsWith('/') && p.startsWith(s)))) return send(res, 404, 'not found');
  const file = path.join(ROOT, path.normalize(decodeURIComponent(p)));
  if (!file.startsWith(ROOT + path.sep)) return send(res, 403, 'forbidden');
  try {
    send(res, 200, await fs.readFile(file), TYPES[path.extname(file)] || 'application/octet-stream');
  } catch {
    send(res, 404, 'not found');
  }
}

const server = http.createServer((req, res) => {
  // DNS 리바인딩 방지: 이 서버 주소로 들어온 요청만 받는다.
  if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`) return send(res, 403, 'forbidden');
  const { pathname } = new URL(req.url, 'http://127.0.0.1');
  if (pathname.startsWith('/api/')) return handleApi(req, res, pathname.slice(5));
  return handleStatic(res, pathname);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && port < (Number(process.env.PORT) || 8000) + 20) {
    port += 1;
    server.listen(port, '127.0.0.1');
    return;
  }
  console.error(err.message);
  process.exit(1);
});
server.on('listening', () => console.log(`http://127.0.0.1:${port}/?token=${TOKEN}`));
server.listen(port, '127.0.0.1');

process.on('SIGINT', () => process.exit(0));
