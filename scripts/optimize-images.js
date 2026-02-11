#!/usr/bin/env node
/**
 * Image Optimization Script
 * Generates optimized thumbnail and large variants of gallery photos.
 *
 * Outputs:
 *   photos/thumbs/  - 800px wide grid thumbnails (JPEG + WebP)
 *   photos/large/   - 2400px wide lightbox images (JPEG + WebP)
 *
 * Also updates photos/photos.json with width/height metadata for each variant.
 *
 * Usage: node scripts/optimize-images.js
 */

const sharp = require('sharp');
const exifr = require('exifr');
const fs = require('fs');
const path = require('path');

const PHOTOS_DIR = path.join(__dirname, '..', 'photos');
const THUMBS_DIR = path.join(PHOTOS_DIR, 'thumbs');
const LARGE_DIR = path.join(PHOTOS_DIR, 'large');
const MANIFEST_PATH = path.join(PHOTOS_DIR, 'photos.json');

const THUMB_MAX_WIDTH = 800;
const THUMB_QUALITY_JPEG = 80;
const THUMB_QUALITY_WEBP = 80;

const LARGE_MAX_WIDTH = 2400;
const LARGE_QUALITY_JPEG = 85;
const LARGE_QUALITY_WEBP = 85;

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

function getBaseName(filename) {
  return filename.replace(/\.(jpe?g|png)$/i, '');
}

async function processImage(photo) {
  const inputPath = path.join(PHOTOS_DIR, photo.filename);

  if (!fs.existsSync(inputPath)) {
    console.warn(`  SKIP: ${photo.filename} not found`);
    return null;
  }

  const baseName = getBaseName(photo.filename);
  const metadata = await sharp(inputPath).metadata();
  const originalWidth = metadata.width;
  const originalHeight = metadata.height;

  const result = {
    ...photo,
    width: originalWidth,
    height: originalHeight,
    thumbs: {},
    large: {}
  };

  // --- Thumbnails (800px wide) ---
  const thumbWidth = Math.min(THUMB_MAX_WIDTH, originalWidth);
  const thumbHeight = Math.round((thumbWidth / originalWidth) * originalHeight);

  // JPEG thumbnail
  const thumbJpegPath = path.join(THUMBS_DIR, `${baseName}.jpg`);
  await sharp(inputPath)
    .resize(thumbWidth, null, { withoutEnlargement: true })
    .jpeg({ quality: THUMB_QUALITY_JPEG, mozjpeg: true })
    .toFile(thumbJpegPath);

  result.thumbs.jpg = `${baseName}.jpg`;
  result.thumbs.width = thumbWidth;
  result.thumbs.height = thumbHeight;

  // WebP thumbnail
  const thumbWebpPath = path.join(THUMBS_DIR, `${baseName}.webp`);
  await sharp(inputPath)
    .resize(thumbWidth, null, { withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY_WEBP })
    .toFile(thumbWebpPath);

  result.thumbs.webp = `${baseName}.webp`;

  // --- Large (2400px wide) ---
  const largeWidth = Math.min(LARGE_MAX_WIDTH, originalWidth);
  const largeHeight = Math.round((largeWidth / originalWidth) * originalHeight);

  // JPEG large
  const largeJpegPath = path.join(LARGE_DIR, `${baseName}.jpg`);
  await sharp(inputPath)
    .resize(largeWidth, null, { withoutEnlargement: true })
    .jpeg({ quality: LARGE_QUALITY_JPEG, mozjpeg: true })
    .toFile(largeJpegPath);

  result.large.jpg = `${baseName}.jpg`;
  result.large.width = largeWidth;
  result.large.height = largeHeight;

  // WebP large
  const largeWebpPath = path.join(LARGE_DIR, `${baseName}.webp`);
  await sharp(inputPath)
    .resize(largeWidth, null, { withoutEnlargement: true })
    .webp({ quality: LARGE_QUALITY_WEBP })
    .toFile(largeWebpPath);

  result.large.webp = `${baseName}.webp`;

  // --- Extract EXIF from original image ---
  try {
    const exif = await exifr.parse(inputPath, {
      pick: ['Model', 'LensModel', 'FocalLength', 'FNumber', 'ExposureTime', 'ISO', 'DateTimeOriginal']
    });

    if (exif) {
      result.exif = {};
      if (exif.Model) result.exif.camera = exif.Model;
      if (exif.LensModel) result.exif.lens = exif.LensModel;
      if (exif.FocalLength) result.exif.focalLength = Math.round(exif.FocalLength);
      if (exif.FNumber) result.exif.aperture = parseFloat(exif.FNumber.toFixed(1));
      if (exif.ExposureTime) {
        if (exif.ExposureTime < 1) {
          result.exif.shutter = `1/${Math.round(1 / exif.ExposureTime)}`;
        } else {
          result.exif.shutter = `${exif.ExposureTime.toFixed(1)}`;
        }
      }
      if (exif.ISO) result.exif.iso = exif.ISO;
      if (exif.DateTimeOriginal) {
        const d = exif.DateTimeOriginal;
        result.exif.date = d instanceof Date
          ? d.toISOString().split('T')[0]
          : String(d);
      }
    }
  } catch (e) {
    // No EXIF data available for this image
  }

  // Report sizes
  const origSize = fs.statSync(inputPath).size;
  const thumbSize = fs.statSync(thumbWebpPath).size;
  const largeSize = fs.statSync(largeWebpPath).size;

  const exifStatus = result.exif ? 'EXIF ok' : 'no EXIF';
  console.log(
    `  ${photo.filename}: ${(origSize / 1024 / 1024).toFixed(1)}MB -> ` +
    `thumb ${(thumbSize / 1024).toFixed(0)}KB, ` +
    `large ${(largeSize / 1024).toFixed(0)}KB (WebP) [${exifStatus}]`
  );

  return result;
}

async function main() {
  console.log('Image Optimization Script');
  console.log('='.repeat(50));

  // Read manifest
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('photos.json not found at', MANIFEST_PATH);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  const photos = manifest.photos || [];

  console.log(`Found ${photos.length} photos in manifest\n`);

  // Create output directories
  await ensureDir(THUMBS_DIR);
  await ensureDir(LARGE_DIR);

  // Process all images
  const results = [];
  let totalOriginal = 0;
  let totalOptimized = 0;

  for (const photo of photos) {
    const result = await processImage(photo);
    if (result) {
      results.push(result);

      const origSize = fs.statSync(path.join(PHOTOS_DIR, photo.filename)).size;
      const thumbSize = fs.statSync(path.join(THUMBS_DIR, `${getBaseName(photo.filename)}.webp`)).size;
      const largeSize = fs.statSync(path.join(LARGE_DIR, `${getBaseName(photo.filename)}.webp`)).size;

      totalOriginal += origSize;
      totalOptimized += thumbSize + largeSize;
    }
  }

  // Write updated manifest
  const updatedManifest = { photos: results };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(updatedManifest, null, 2) + '\n');

  console.log('\n' + '='.repeat(50));
  console.log(`Processed ${results.length} images`);
  console.log(`Original total:  ${(totalOriginal / 1024 / 1024).toFixed(1)}MB`);
  console.log(`Optimized total: ${(totalOptimized / 1024 / 1024).toFixed(1)}MB (thumbs + large WebP)`);
  console.log(`Reduction:       ${(100 - (totalOptimized / totalOriginal * 100)).toFixed(1)}%`);
  console.log(`\nUpdated photos.json with dimensions and variant paths`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
