#!/usr/bin/env node
// Downloads the canonical zap-proto/rust zapc binary for this platform/arch from
// the matching GitHub release. Native binaries only — no build on install.
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const VERSION = require('./package.json').version;
const REPO = 'zap-proto/rust';
const TAG = `zapc-v${VERSION}`;
const TARGETS = {
  'darwin-arm64': 'aarch64-apple-darwin',
  'darwin-x64': 'x86_64-apple-darwin',
  'linux-x64': 'x86_64-unknown-linux-musl',
  'linux-arm64': 'aarch64-unknown-linux-musl',
};

const key = `${process.platform}-${process.arch}`;
const target = TARGETS[key];
if (!target) {
  console.error(`[zapc] unsupported platform ${key} (darwin/linux × x64/arm64 only)`);
  process.exit(1);
}

const binDir = path.join(__dirname, 'bin');
fs.mkdirSync(binDir, { recursive: true });
const url = `https://github.com/${REPO}/releases/download/${TAG}/zapc-${target}.tar.gz`;
const tarPath = path.join(binDir, 'zapc.tar.gz');

function download(u, dest, cb) {
  https.get(u, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302) return download(res.headers.location, dest, cb);
    if (res.statusCode !== 200) { console.error(`[zapc] download failed ${res.statusCode}: ${u}`); process.exit(1); }
    const f = fs.createWriteStream(dest);
    res.pipe(f);
    f.on('finish', () => f.close(cb));
  }).on('error', (e) => { console.error('[zapc]', e.message); process.exit(1); });
}

console.log(`[zapc] downloading ${target} ${TAG}`);
download(url, tarPath, () => {
  execFileSync('tar', ['-xzf', tarPath, '-C', binDir]);
  fs.unlinkSync(tarPath);
  fs.chmodSync(path.join(binDir, 'zapc'), 0o755);
  console.log('[zapc] installed bin/zapc');
});
