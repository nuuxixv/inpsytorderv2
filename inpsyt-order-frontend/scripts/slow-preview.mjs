/**
 * 저대역 검수 서버 — 행사장 회선을 재현해 dist/를 서빙한다.
 *
 * 왜 vite preview로는 부족한가:
 *  1) 대역폭 제한이 없다. 사무실 회선에서는 3MB든 300KB든 똑같이 즉시 뜬다.
 *     2026-07 오티즘 장애는 "느릴 때만" 드러나는 종류였다.
 *  2) 프로덕션 라우팅과 다르다. Vercel은 `/assets/*`를 SPA rewrite에서 제외해
 *     없는 에셋에 404를 낸다(vercel.json). vite preview는 SPA 폴백으로 HTML을
 *     돌려줘서, 배포 후 스테일 에셋 상황을 재현할 수 없다.
 *
 * 사용법:
 *   npm run build
 *   node scripts/slow-preview.mjs --preset venue
 *   → http://localhost:4273
 *
 * 옵션:
 *   --preset slow-3g | fast-3g | venue   프리셋 (기본 venue)
 *   --kbps <n>       하향 대역폭 kbps (프리셋보다 우선)
 *   --latency <ms>   응답 첫 바이트 지연 (프리셋보다 우선)
 *   --port <n>       기본 4273
 *   --dir <path>     기본 dist
 *   --break-font     폰트 CDN을 도달 불가 주소로 바꿔 서빙 (시나리오 B)
 *   --break-assets   에셋 해시를 옛것으로 바꿔 서빙 = 배포 후 스테일 상태 (시나리오 C)
 *   --cold           모든 응답에 no-store. 측정을 반복할 때 쓴다. 에셋이
 *                    immutable로 캐시되면 두 번째 로드가 즉시 떠서 첫 방문
 *                    체감을 못 재는데, 부스 방문객은 전원 첫 방문이다.
 *
 * 프리셋 근거: slow-3g·fast-3g는 Chrome DevTools 프리셋과 같은 값.
 * venue는 관람객이 몰린 학회장 공용 와이파이 체감치(타팀 피드백 기준).
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';

const PRESETS = {
  'slow-3g': { kbps: 400, latency: 400 },
  'fast-3g': { kbps: 1600, latency: 300 },
  venue: { kbps: 600, latency: 500 },
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const preset = PRESETS[arg('preset', 'venue')] ?? PRESETS.venue;
const KBPS = Number(arg('kbps', preset.kbps));
const LATENCY = Number(arg('latency', preset.latency));
const PORT = Number(arg('port', 4273));
const DIR = arg('dir', 'dist');
const COLD = process.argv.includes('--cold');
// 장애 시나리오 주입 플래그. dist를 수정하지 않고 응답만 바꾼다.
const BREAK_FONT = process.argv.includes('--break-font');
const BREAK_ASSETS = process.argv.includes('--break-assets');

const TICK_MS = 50;
const BYTES_PER_TICK = Math.max(1, Math.round((KBPS * 1024) / 8 / (1000 / TICK_MS)));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readIfFile(path) {
  try {
    const s = await stat(path);
    if (!s.isFile()) return null;
    return await readFile(path);
  } catch {
    return null;
  }
}

// 대역폭은 전역 토큰 버킷 하나로 관리한다. 응답별로 제한하면 브라우저가
// 에셋 4개를 병렬로 받을 때 총 대역폭이 4배가 되어(=사무실 회선) 재현이 무의미해진다.
// 실제 회선은 공유 파이프다.
let tokens = 0;
const waiters = [];

setInterval(() => {
  tokens = Math.min(tokens + BYTES_PER_TICK, BYTES_PER_TICK * 2);
  while (waiters.length > 0 && tokens > 0) {
    const w = waiters.shift();
    const grant = Math.min(tokens, w.want);
    tokens -= grant;
    w.resolve(grant);
  }
}, TICK_MS).unref();

const takeTokens = (want) => new Promise((resolve) => waiters.push({ want, resolve }));

/** 대역폭 제한 전송 — 전역 버킷에서 받은 만큼만 흘린다. */
async function sendThrottled(res, body) {
  let offset = 0;
  while (offset < body.length) {
    if (res.destroyed) return;
    const grant = await takeTokens(Math.min(BYTES_PER_TICK, body.length - offset));
    res.write(body.subarray(offset, offset + grant));
    offset += grant;
  }
  res.end();
}

const server = createServer(async (req, res) => {
  // 쿼리 제거 + 상위경로 탈출 차단
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  // `/_vercel/*`(Analytics 스크립트)는 Vercel 플랫폼이 직접 처리한다. 로컬에는
  // 없으므로, SPA 폴백으로 HTML을 돌려주면 "JS 요청에 HTML 응답"이라는 없는
  // 실패 모드를 검수 환경이 만들어낸다. 프로덕션처럼 조용히 없는 것으로 둔다.
  const isAsset = urlPath.startsWith('/assets/');
  // SPA 폴백을 적용하지 않는 경로. 에셋 + 플랫폼 경로.
  const noFallback = isAsset || urlPath.startsWith('/_vercel/');

  let filePath = join(DIR, safePath);
  let body = await readIfFile(filePath);

  if (!body) {
    if (noFallback) {
      // 프로덕션(vercel.json)과 동일: 에셋은 SPA 폴백 대상이 아니다.
      // 배포 후 스테일 에셋 상황이 여기서 그대로 재현된다.
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404');
      console.log(`404      ${urlPath}`);
      return;
    }
    filePath = join(DIR, 'index.html');
    body = await readIfFile(filePath);
    if (!body) {
      res.writeHead(500).end('dist/index.html 없음 — npm run build 먼저');
      return;
    }
  }

  // 장애 시나리오 주입. dist 파일을 건드리지 않고 서빙 시점에만 바꾼다.
  // sed로 index.html을 고치는 방식은 셸마다 명령이 다르고(PowerShell엔 sed 없음)
  // 백업·복원을 잊으면 dist가 망가진 채 남는다. 실제 라우트에서 그대로 테스트된다.
  if (extname(filePath).toLowerCase() === '.html') {
    let html = body.toString('utf8');
    if (BREAK_FONT) {
      html = html.replace(/https:\/\/cdn\.jsdelivr\.net\/[^"']+/g, 'https://cdn-does-not-exist.invalid/x.css');
    }
    if (BREAK_ASSETS) {
      html = html.replace(/\/assets\/(index|mui|vendor)-[A-Za-z0-9_-]+\.(js|css)/g, '/assets/$1-STALEHASH.$2');
    }
    body = Buffer.from(html, 'utf8');
  }

  const ext = extname(filePath).toLowerCase();

  // 프로덕션은 gzip으로 내려간다. 압축을 안 하면 대역폭 수치가 3배쯤
  // 비관적으로 나와 검수 결과를 못 믿게 된다.
  const compressible = ['.html', '.js', '.css', '.svg', '.json', '.map'].includes(ext);
  const wantsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
  const raw = body.length;
  const headers = {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': COLD
      ? 'no-store'
      : isAsset
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=0, must-revalidate',
  };
  if (compressible && wantsGzip) {
    body = gzipSync(body);
    headers['Content-Encoding'] = 'gzip';
    headers.Vary = 'Accept-Encoding';
  }
  headers['Content-Length'] = body.length;
  res.writeHead(200, headers);

  const seconds = (body.length / ((KBPS * 1024) / 8)).toFixed(1);
  console.log(`200      ${urlPath}  ${raw}B → ${body.length}B  ~${seconds}s`);

  await sleep(LATENCY);
  await sendThrottled(res, body);
});

server.listen(PORT, () => {
  console.log(`저대역 검수 서버  http://localhost:${PORT}`);
  console.log(`  대역폭 ${KBPS} kbps / 지연 ${LATENCY} ms / 서빙 ${DIR}${COLD ? ' / no-store(cold)' : ''}`);
  if (BREAK_FONT) console.log('  [주입] 폰트 CDN 도달 불가 — 시나리오 B');
  if (BREAK_ASSETS) console.log('  [주입] 에셋 해시 스테일 — 시나리오 C');
  console.log(`  /assets/* 는 없으면 404 (프로덕션 rewrite 규칙과 동일)`);
});
