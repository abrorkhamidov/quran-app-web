import { mkdir, writeFile, rm, stat, rename } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'web/public/fonts/qcf2');
const RAW = 'https://raw.githubusercontent.com/nuqayah/qpc-fonts/master/mushaf-v2';
const TOTAL = 604;
const MIN_BYTES = 1024;

// fonttools binary from the local venv (preferred WOFF2 path).
const FONTTOOLS = resolve(ROOT, '.venv-fonts/bin/fonttools');

const pad = (n) => String(n).padStart(3, '0');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PY = resolve(ROOT, '.venv-fonts/bin/python');

async function detectWoff2() {
  // Require both fonttools and brotli to be importable, otherwise woff2
  // compression silently fails. Probe via the venv python.
  try {
    await run(PY, ['-c', 'import fontTools, brotli']);
    return true;
  } catch {
    return false;
  }
}

async function download(url, dest, attempts = 5) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < MIN_BYTES) throw new Error(`too small: ${buf.length} bytes`);
      await writeFile(dest, buf);
      return;
    } catch (err) {
      lastErr = err;
      if (i < attempts) await sleep(250 * 2 ** (i - 1));
    }
  }
  throw new Error(`failed ${url}: ${lastErr?.message}`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const useWoff2 = await detectWoff2();
  console.log(useWoff2 ? 'mode: WOFF2 (fonttools available)' : 'mode: TTF fallback');

  const faces = [];
  for (let p = 1; p <= TOTAL; p++) {
    const url = `${RAW}/QCF2${pad(p)}.ttf`;
    if (useWoff2) {
      const tmp = resolve(OUT, `p${p}.ttf`);
      await download(url, tmp);
      await run(FONTTOOLS, ['ttLib.woff2', 'compress', tmp]); // writes p{p}.woff2
      const produced = resolve(OUT, `p${p}.woff2`);
      const st = await stat(produced);
      if (st.size < MIN_BYTES) throw new Error(`woff2 too small for page ${p}`);
      await rm(tmp);
      faces.push(
        `@font-face{font-family:'QCF2P${p}';src:url('./p${p}.woff2') format('woff2');font-display:swap;}`,
      );
    } else {
      const dest = resolve(OUT, `p${p}.ttf`);
      await download(url, dest);
      faces.push(
        `@font-face{font-family:'QCF2P${p}';src:url('./p${p}.ttf') format('truetype');font-display:swap;}`,
      );
    }
    if (p % 50 === 0) console.log(`progress: ${p}/${TOTAL}`);
  }

  await writeFile(resolve(OUT, 'qcf2.css'), faces.join('\n') + '\n');
  console.log(`done: ${TOTAL} fonts + qcf2.css`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
