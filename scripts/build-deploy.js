#!/usr/bin/env node
/**
 * Build deployable static output into dist/.
 * Keeps optimized gallery assets while excluding raw originals from /photos.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const SOURCE_PHOTOS_DIR = path.join(ROOT, 'photos');
const DIST_PHOTOS_DIR = path.join(DIST_DIR, 'photos');

const ROOT_ENTRIES = [
  'index.html',
  'css',
  'js',
  'pages',
  'assets',
  'favicon.svg',
  'favicon.ico'
];

const OPTIMIZED_PHOTO_ENTRIES = ['photos.json', 'thumbs', 'medium', 'large'];

function relPath(filePath) {
  return path.relative(ROOT, filePath) || '.';
}

function filterCopy(sourcePath) {
  const base = path.basename(sourcePath);
  if (base === '.DS_Store') return false;
  return true;
}

function assertExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required path missing: ${relPath(filePath)}`);
  }
}

function copyEntry(fromPath, toPath) {
  fs.cpSync(fromPath, toPath, {
    recursive: true,
    force: true,
    filter: filterCopy
  });
  console.log(`Copied ${relPath(fromPath)} -> ${relPath(toPath)}`);
}

function getDirectorySizeBytes(dirPath) {
  let total = 0;

  if (!fs.existsSync(dirPath)) return total;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += getDirectorySizeBytes(fullPath);
    } else {
      total += fs.statSync(fullPath).size;
    }
  }

  return total;
}

function bytesToMB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

function validateNoRawPhotosInDist() {
  const entries = fs.readdirSync(DIST_PHOTOS_DIR, { withFileTypes: true });

  const rawPhotoFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(jpe?g|png)$/i.test(name));

  if (rawPhotoFiles.length > 0) {
    throw new Error(
      `Raw photo originals detected in dist/photos: ${rawPhotoFiles.join(', ')}`
    );
  }
}

function main() {
  console.log('Build Deploy Script');
  console.log('='.repeat(60));

  for (const entry of OPTIMIZED_PHOTO_ENTRIES) {
    assertExists(path.join(SOURCE_PHOTOS_DIR, entry));
  }

  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });

  for (const entry of ROOT_ENTRIES) {
    const fromPath = path.join(ROOT, entry);
    if (!fs.existsSync(fromPath)) {
      console.warn(`Skipped missing optional entry: ${entry}`);
      continue;
    }

    const toPath = path.join(DIST_DIR, entry);
    copyEntry(fromPath, toPath);
  }

  fs.mkdirSync(DIST_PHOTOS_DIR, { recursive: true });

  for (const entry of OPTIMIZED_PHOTO_ENTRIES) {
    const fromPath = path.join(SOURCE_PHOTOS_DIR, entry);
    const toPath = path.join(DIST_PHOTOS_DIR, entry);
    copyEntry(fromPath, toPath);
  }

  validateNoRawPhotosInDist();

  const sizeBytes = getDirectorySizeBytes(DIST_DIR);
  console.log('-'.repeat(60));
  console.log(`dist/ size: ${bytesToMB(sizeBytes)}`);
  console.log('Build complete: dist/ contains only deploy-ready assets.');
}

try {
  main();
} catch (err) {
  console.error('Build failed:', err.message);
  process.exit(1);
}
