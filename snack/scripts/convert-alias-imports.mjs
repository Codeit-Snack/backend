/**
 * Replaces `from '@/…'` with relative paths to `src/`.
 * Run from repo: node scripts/convert-alias-imports.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function walkTs(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      walkTs(full, out);
    } else if (e.name.endsWith('.ts')) {
      out.push(full);
    }
  }
}

function toRelative(fromFile, spec) {
  const target = path.join(root, 'src', ...spec.split('/'));
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, target).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

function processFile(filePath) {
  let s = fs.readFileSync(filePath, 'utf8');
  const re = /\bfrom\s+(['"])@\/([^'"]+)\1/g;
  const next = s.replace(re, (_, q, spec) => `from ${q}${toRelative(filePath, spec)}${q}`);
  if (next !== s) {
    fs.writeFileSync(filePath, next);
    return 1;
  }
  return 0;
}

const files = [];
walkTs(path.join(root, 'src'), files);
walkTs(path.join(root, 'test'), files);

let n = 0;
for (const f of files) {
  n += processFile(f);
}
console.log(`Updated ${n} file(s) with relative imports (${files.length} scanned).`);
