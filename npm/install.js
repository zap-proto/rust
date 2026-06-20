#!/usr/bin/env node
// Downloads the canonical zap-proto/rust zapc binary for this platform/arch from
// the matching GitHub release. Native binaries only — no build on install.
//
// SUPPLY CHAIN: the release publishes `<asset>.tar.gz.sha256` next to each
// tarball (`shasum -a 256 <asset>.tar.gz`). We download that digest first and
// verify the tarball against it with SHA-256 BEFORE extracting, chmod, or exec.
// Fail closed on any download error, malformed digest, or mismatch — a tampered
// or truncated asset never reaches the filesystem as an executable.
const https = require('https');
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
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
const asset = `zapc-${target}.tar.gz`;
const base = `https://github.com/${REPO}/releases/download/${TAG}`;
const url = `${base}/${asset}`;
const sumUrl = `${url}.sha256`;
const tarPath = path.join(binDir, 'zapc.tar.gz');

function fail(msg) {
  console.error(`[zapc] ${msg}`);
  process.exit(1);
}

// Follow redirects, buffer the whole body. Used for the small .sha256 file.
function fetchText(u, cb, redirects = 0) {
  if (redirects > 5) return fail(`too many redirects fetching ${u}`);
  https.get(u, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      res.resume();
      return fetchText(res.headers.location, cb, redirects + 1);
    }
    if (res.statusCode !== 200) return fail(`download failed ${res.statusCode}: ${u}`);
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => cb(Buffer.concat(chunks).toString('utf8')));
  }).on('error', (e) => fail(e.message));
}

// Follow redirects, stream to dest. Used for the (large) tarball.
function download(u, dest, cb, redirects = 0) {
  if (redirects > 5) return fail(`too many redirects fetching ${u}`);
  https.get(u, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      res.resume();
      return download(res.headers.location, dest, cb, redirects + 1);
    }
    if (res.statusCode !== 200) return fail(`download failed ${res.statusCode}: ${u}`);
    const f = fs.createWriteStream(dest);
    res.pipe(f);
    f.on('finish', () => f.close(cb));
  }).on('error', (e) => fail(e.message));
}

// `shasum -a 256 file` → "<64-hex>  file". Take the first token, validate shape.
function parseSha256(text) {
  const hex = text.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  if (!/^[0-9a-f]{64}$/.test(hex)) fail(`malformed .sha256 digest: ${JSON.stringify(text)}`);
  return hex;
}

function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

console.log(`[zapc] downloading ${target} ${TAG}`);
fetchText(sumUrl, (sumText) => {
  const expected = parseSha256(sumText);
  download(url, tarPath, () => {
    const actual = sha256File(tarPath);
    if (actual !== expected) {
      fs.unlinkSync(tarPath);
      fail(`checksum mismatch for ${asset}\n  expected ${expected}\n  actual   ${actual}`);
    }
    execFileSync('tar', ['-xzf', tarPath, '-C', binDir]);
    fs.unlinkSync(tarPath);
    fs.chmodSync(path.join(binDir, 'zapc'), 0o755);
    console.log('[zapc] installed bin/zapc (sha256 verified)');
  });
});
