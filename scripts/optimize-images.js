#!/usr/bin/env node
/**
 * Image Optimization Script
 * Generates optimized gallery variants and updates photos/photos.json.
 *
 * Outputs:
 *   photos/thumbs/  - 800px variants (JPEG + WebP + AVIF)
 *   photos/medium/  - 1600px variants (JPEG + WebP + AVIF)
 *   photos/large/   - 2400px variants (JPEG + WebP + AVIF)
 *
 * Usage: node scripts/optimize-images.js
 * Optional env: IMAGE_CONCURRENCY=4
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const exifr = require('exifr');

const PHOTOS_DIR = path.join(__dirname, '..', 'photos');
const MANIFEST_PATH = path.join(PHOTOS_DIR, 'photos.json');

const VARIANTS = [
  {
    key: 'thumbs',
    dir: path.join(PHOTOS_DIR, 'thumbs'),
    maxWidth: 800,
    jpegQuality: 80,
    webpQuality: 80,
    avifQuality: 58
  },
  {
    key: 'medium',
    dir: path.join(PHOTOS_DIR, 'medium'),
    maxWidth: 1600,
    jpegQuality: 84,
    webpQuality: 84,
    avifQuality: 52
  },
  {
    key: 'large',
    dir: path.join(PHOTOS_DIR, 'large'),
    maxWidth: 2400,
    jpegQuality: 85,
    webpQuality: 85,
    avifQuality: 48
  }
];

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${path.relative(PHOTOS_DIR, dir)}`);
  }
}

function getBaseName(filename) {
  return filename.replace(/\.(jpe?g|png)$/i, '');
}

function bytesToMB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function bytesToKB(bytes) {
  return `${(bytes / 1024).toFixed(0)}KB`;
}

function parseConcurrency() {
  const requested = Number.parseInt(process.env.IMAGE_CONCURRENCY || '', 10);
  if (Number.isFinite(requested) && requested > 0) return requested;

  const cpuCount = os.cpus()?.length || 1;
  return Math.max(1, Math.min(cpuCount, 6));
}

async function generateVariant(inputPath, baseName, originalWidth, originalHeight, variant) {
  const width = Math.min(variant.maxWidth, originalWidth);
  const height = Math.max(1, Math.round((width / originalWidth) * originalHeight));

  const jpgName = `${baseName}.jpg`;
  const webpName = `${baseName}.webp`;
  const avifName = `${baseName}.avif`;

  const jpgPath = path.join(variant.dir, jpgName);
  const webpPath = path.join(variant.dir, webpName);
  const avifPath = path.join(variant.dir, avifName);

  const basePipeline = sharp(inputPath)
    .rotate()
    .resize(width, null, { withoutEnlargement: true });

  await Promise.all([
    basePipeline
      .clone()
      .jpeg({ quality: variant.jpegQuality, mozjpeg: true })
      .toFile(jpgPath),
    basePipeline
      .clone()
      .webp({ quality: variant.webpQuality })
      .toFile(webpPath),
    basePipeline
      .clone()
      .avif({ quality: variant.avifQuality, effort: 4 })
      .toFile(avifPath)
  ]);

  const totalBytes =
    fs.statSync(jpgPath).size +
    fs.statSync(webpPath).size +
    fs.statSync(avifPath).size;

  return {
    manifestData: {
      jpg: jpgName,
      webp: webpName,
      avif: avifName,
      width,
      height
    },
    totalBytes,
    webpBytes: fs.statSync(webpPath).size,
    avifBytes: fs.statSync(avifPath).size
  };
}

function parseExifShutter(exposureTime) {
  if (!exposureTime) return null;
  if (exposureTime < 1) return `1/${Math.round(1 / exposureTime)}`;
  return `${exposureTime.toFixed(1)}`;
}

async function extractExif(inputPath) {
  try {
    const exif = await exifr.parse(inputPath, {
      pick: [
        'Model',
        'LensModel',
        'FocalLength',
        'FNumber',
        'ExposureTime',
        'ISO',
        'DateTimeOriginal'
      ]
    });

    if (!exif) return null;

    const result = {};
    if (exif.Model) result.camera = exif.Model;
    if (exif.LensModel) result.lens = exif.LensModel;
    if (exif.FocalLength) result.focalLength = Math.round(exif.FocalLength);
    if (exif.FNumber) result.aperture = parseFloat(exif.FNumber.toFixed(1));

    const shutter = parseExifShutter(exif.ExposureTime);
    if (shutter) result.shutter = shutter;

    if (exif.ISO) result.iso = exif.ISO;
    if (exif.DateTimeOriginal) {
      const date = exif.DateTimeOriginal;
      result.date = date instanceof Date
        ? date.toISOString().split('T')[0]
        : String(date);
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (_err) {
    return null;
  }
}

async function processImage(photo, index, total) {
  const inputPath = path.join(PHOTOS_DIR, photo.filename);

  if (!fs.existsSync(inputPath)) {
    console.warn(`[${index + 1}/${total}] SKIP missing file: ${photo.filename}`);
    return null;
  }

  const metadata = await sharp(inputPath).rotate().metadata();
  const originalWidth = metadata.width;
  const originalHeight = metadata.height;

  if (!originalWidth || !originalHeight) {
    console.warn(`[${index + 1}/${total}] SKIP unreadable dimensions: ${photo.filename}`);
    return null;
  }

  const baseName = getBaseName(photo.filename);
  const output = {
    ...photo,
    width: originalWidth,
    height: originalHeight
  };

  let optimizedBytes = 0;
  const perVariant = {};

  for (const variant of VARIANTS) {
    const generated = await generateVariant(
      inputPath,
      baseName,
      originalWidth,
      originalHeight,
      variant
    );

    output[variant.key] = generated.manifestData;
    optimizedBytes += generated.totalBytes;

    perVariant[variant.key] = {
      webpBytes: generated.webpBytes,
      avifBytes: generated.avifBytes
    };
  }

  const exif = await extractExif(inputPath);
  if (exif) {
    output.exif = exif;
  }

  const originalBytes = fs.statSync(inputPath).size;
  const reduction = originalBytes > 0
    ? 100 - ((optimizedBytes / originalBytes) * 100)
    : 0;

  const exifStatus = exif ? 'EXIF ok' : 'no EXIF';
  console.log(
    `[${index + 1}/${total}] ${photo.filename}: ${bytesToMB(originalBytes)} -> ` +
    `thumb ${bytesToKB(perVariant.thumbs.webpBytes)} webp / ${bytesToKB(perVariant.thumbs.avifBytes)} avif, ` +
    `medium ${bytesToKB(perVariant.medium.webpBytes)} webp / ${bytesToKB(perVariant.medium.avifBytes)} avif, ` +
    `large ${bytesToKB(perVariant.large.webpBytes)} webp / ${bytesToKB(perVariant.large.avifBytes)} avif ` +
    `(${reduction.toFixed(1)}% net) [${exifStatus}]`
  );

  return {
    photo: output,
    originalBytes,
    optimizedBytes
  };
}

async function processWithConcurrency(items, concurrency, handler) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;

      if (index >= items.length) return;

      try {
        results[index] = await handler(items[index], index, items.length);
      } catch (err) {
        console.error(`Failed processing ${items[index]?.filename || 'unknown file'}:`, err.message);
        results[index] = null;
      }
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

async function main() {
  console.log('Image Optimization Script');
  console.log('='.repeat(70));

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`photos.json not found at ${MANIFEST_PATH}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  const photos = Array.isArray(manifest.photos) ? manifest.photos : [];

  const concurrency = parseConcurrency();
  console.log(`Found ${photos.length} photos in manifest`);
  console.log(`Using concurrency: ${concurrency}`);

  for (const variant of VARIANTS) {
    await ensureDir(variant.dir);
  }

  if (photos.length === 0) {
    const emptyManifest = { ...manifest, photos: [] };
    fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(emptyManifest, null, 2)}\n`);

    console.log('\nNo photos found. Wrote manifest with empty photos array.');
    console.log('Nothing to optimize.');
    return;
  }

  const processed = await processWithConcurrency(
    photos,
    concurrency,
    processImage
  );

  const results = processed.filter(Boolean);
  const optimizedPhotos = results.map(result => result.photo);

  const totalOriginalBytes = results.reduce((sum, result) => sum + result.originalBytes, 0);
  const totalOptimizedBytes = results.reduce((sum, result) => sum + result.optimizedBytes, 0);

  const updatedManifest = {
    ...manifest,
    photos: optimizedPhotos
  };

  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(updatedManifest, null, 2)}\n`);

  const totalReduction = totalOriginalBytes > 0
    ? 100 - ((totalOptimizedBytes / totalOriginalBytes) * 100)
    : 0;

  console.log('\n' + '='.repeat(70));
  console.log(`Processed ${optimizedPhotos.length}/${photos.length} images`);
  console.log(`Original total:  ${bytesToMB(totalOriginalBytes)}`);
  console.log(`Optimized total: ${bytesToMB(totalOptimizedBytes)} (thumbs + medium + large, all formats)`);
  console.log(`Reduction:       ${totalReduction.toFixed(1)}%`);
  console.log('Updated photos.json with variant dimensions and paths.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
