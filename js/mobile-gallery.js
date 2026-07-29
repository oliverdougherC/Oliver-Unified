/**
 * Mobile Gallery JavaScript
 * Self-contained IIFE: loads photo data, renders a 2-column masonry grid,
 * and provides a fullscreen swipeable lightbox.
 *
 * No dependency on gallery.js global state.
 */
(function () {
  'use strict';

  const MANIFEST_PATH = '../../assets/photos/photos.json';
  const SEQUENCE_PATH = '../../assets/photos/gallery-sequence.json';
  const ASSET_BASE = '../../assets/photos/';
  const THUMB_BASE = ASSET_BASE + 'thumbs/';
  const MEDIUM_BASE = ASSET_BASE + 'medium/';
  const LARGE_BASE = ASSET_BASE + 'large/';
  const SWIPE_THRESHOLD = 50;

  let entries = [];
  let currentIndex = -1;
  let touchStartX = 0;
  let touchStartY = 0;

  /* ---- Utility functions ---- */

  function basenameFromPath(value) {
    if (!value) return '';
    const normalized = String(value).split('?')[0].split('#')[0];
    const segments = normalized.split('/');
    return segments[segments.length - 1];
  }

  function normalizeGalleryKey(value) {
    const stem = basenameFromPath(value).toLowerCase().replace(/\.(avif|webp|jpe?g|png)$/i, '');
    return stem.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function formatTitle(filename) {
    const parts = basenameFromPath(filename)
      .replace(/\.(avif|webp|jpe?g|png)$/i, '')
      .split(/[-_]+/)
      .filter(Boolean);
    return parts
      .map(function (part) {
        if (/\d/.test(part)) return part.toUpperCase();
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(' ');
  }

  function resolveVariantPath(variant, format, basePath, fallbackFilename) {
    if (fallbackFilename === void 0) fallbackFilename = '';
    if (variant && variant[format]) return basePath + variant[format];
    if (fallbackFilename && format === 'jpg') return basePath + fallbackFilename;
    return '';
  }

  function extractYear(dateStr) {
    if (!dateStr) return '';
    var match = String(dateStr).match(/^(\d{4})/);
    return match ? match[1] : '';
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      var date = new Date(dateStr + 'T00:00:00');
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  function buildAssetMap(photo) {
    return {
      thumbJpg: resolveVariantPath(photo.thumbs, 'jpg', THUMB_BASE, photo.filename),
      thumbWebp: resolveVariantPath(photo.thumbs, 'webp', THUMB_BASE),
      thumbAvif: resolveVariantPath(photo.thumbs, 'avif', THUMB_BASE),
      mediumJpg: resolveVariantPath(photo.medium, 'jpg', MEDIUM_BASE, photo.filename),
      mediumWebp: resolveVariantPath(photo.medium, 'webp', MEDIUM_BASE),
      mediumAvif: resolveVariantPath(photo.medium, 'avif', MEDIUM_BASE),
      largeJpg: resolveVariantPath(photo.large, 'jpg', LARGE_BASE, photo.filename),
      largeWebp: resolveVariantPath(photo.large, 'webp', LARGE_BASE),
      largeAvif: resolveVariantPath(photo.large, 'avif', LARGE_BASE),
      thumbWidth: Number(photo.thumbs?.width) || 800,
      thumbHeight: Number(photo.thumbs?.height) || 534,
      mediumWidth: Number(photo.medium?.width) || 1600,
      mediumHeight: Number(photo.medium?.height) || 1067,
      largeWidth: Number(photo.large?.width) || 2400,
      largeHeight: Number(photo.large?.height) || 1601
    };
  }

  function mergeGalleryEntry(photo, manifestIndex, sequenceItems, sequenceLookup) {
    var matchedSequence = sequenceLookup.get(normalizeGalleryKey(photo.id))
      || sequenceLookup.get(normalizeGalleryKey(photo.filename))
      || sequenceLookup.get(normalizeGalleryKey(photo.displayTitle))
      || sequenceLookup.get(normalizeGalleryKey(photo.title))
      || null;

    var sequenceIndex = (matchedSequence && Number.isInteger(matchedSequence.__sequenceIndex))
      ? matchedSequence.__sequenceIndex
      : null;

    var id = matchedSequence?.id
      || photo.id
      || normalizeGalleryKey(photo.filename || photo.displayTitle || photo.title || 'photo-' + (manifestIndex + 1));
    var displayTitle = matchedSequence?.title
      || photo.displayTitle
      || photo.title
      || formatTitle(photo.filename || 'Photo ' + (manifestIndex + 1));
    var date = photo.exif?.date || matchedSequence?.meta?.date || '';
    var year = matchedSequence?.index?.year || extractYear(date) || '';
    var order = sequenceIndex !== null ? sequenceIndex : sequenceItems.length + manifestIndex;

    return {
      id: id,
      displayTitle: displayTitle,
      date: date,
      year: year,
      dateLabel: formatDate(date),
      order: order,
      width: Number(photo.width) || Number(photo.large?.width) || Number(photo.medium?.width) || 1600,
      height: Number(photo.height) || Number(photo.large?.height) || Number(photo.medium?.height) || 1067,
      assets: buildAssetMap(photo)
    };
  }

  /* ---- Data loading ---- */

  async function loadData() {
    var manifestResp, sequenceResp;
    try {
      manifestResp = await fetch(MANIFEST_PATH);
      if (!manifestResp.ok) throw new Error('Manifest fetch failed: ' + manifestResp.status);
    } catch (e) {
      console.error('Failed to load photo manifest:', e);
      throw e;
    }

    var manifest = await manifestResp.json();
    var photos = manifest.photos || [];

    var sequenceItems = [];
    try {
      sequenceResp = await fetch(SEQUENCE_PATH);
      if (sequenceResp.ok) {
        var sequence = await sequenceResp.json();
        sequenceItems = sequence.items || [];
      }
    } catch (e) {
      console.warn('Sequence file not found or failed to load; using manifest order:', e);
    }

    return { photos: photos, sequenceItems: sequenceItems };
  }

  function buildEntries(photos, sequenceItems) {
    var sequenceLookup = new Map();
    sequenceItems.forEach(function (item, idx) {
      item.__sequenceIndex = idx;
      var key = item.id ? normalizeGalleryKey(item.id) : '';
      if (key) sequenceLookup.set(key, item);
      if (item.title) sequenceLookup.set(normalizeGalleryKey(item.title), item);
    });

    return photos.map(function (photo, idx) {
      return mergeGalleryEntry(photo, idx, sequenceItems, sequenceLookup);
    }).sort(function (a, b) {
      return a.order - b.order;
    });
  }

  /* ---- Grid rendering ---- */

  function renderGrid(container, photoEntries) {
    var fragment = document.createDocumentFragment();

    photoEntries.forEach(function (entry, index) {
      var picture = document.createElement('picture');
      var assets = entry.assets;

      if (assets.thumbAvif) {
        var avifSource = document.createElement('source');
        avifSource.srcset = assets.thumbAvif;
        avifSource.type = 'image/avif';
        picture.appendChild(avifSource);
      }

      if (assets.thumbWebp) {
        var webpSource = document.createElement('source');
        webpSource.srcset = assets.thumbWebp;
        webpSource.type = 'image/webp';
        picture.appendChild(webpSource);
      }

      var img = document.createElement('img');
      img.src = assets.thumbJpg || '';
      img.alt = entry.displayTitle || 'Photograph';
      img.setAttribute('data-entry-index', index);
      img.width = assets.thumbWidth;
      img.height = assets.thumbHeight;

      if (index >= 4) {
        img.loading = 'lazy';
        img.decoding = 'async';
      }

      picture.appendChild(img);
      fragment.appendChild(picture);
    });

    container.appendChild(fragment);
  }

  /* ---- Lightbox ---- */

  function getLightboxElements() {
    return {
      overlay: document.getElementById('mobileLightbox'),
      close: document.getElementById('mobileLightboxClose'),
      media: document.getElementById('mobileLightboxMedia'),
      sourceAvif: document.getElementById('mobileLightboxSourceAvif'),
      sourceWebp: document.getElementById('mobileLightboxSourceWebp'),
      image: document.getElementById('mobileLightboxImage')
    };
  }

  function openLightbox(index) {
    if (index < 0 || index >= entries.length) return;
    currentIndex = index;

    var el = getLightboxElements();
    var entry = entries[index];
    var assets = entry.assets;

    // Build srcset with medium + large variants
    var srcsetCandidates = [];
    if (assets.mediumJpg) srcsetCandidates.push(assets.mediumJpg + ' ' + assets.mediumWidth + 'w');
    if (assets.largeJpg) srcsetCandidates.push(assets.largeJpg + ' ' + assets.largeWidth + 'w');
    var jpgSrcset = srcsetCandidates.join(', ');

    var avifSrcsetCandidates = [];
    if (assets.mediumAvif) avifSrcsetCandidates.push(assets.mediumAvif + ' ' + assets.mediumWidth + 'w');
    if (assets.largeAvif) avifSrcsetCandidates.push(assets.largeAvif + ' ' + assets.largeWidth + 'w');

    var webpSrcsetCandidates = [];
    if (assets.mediumWebp) webpSrcsetCandidates.push(assets.mediumWebp + ' ' + assets.mediumWidth + 'w');
    if (assets.largeWebp) webpSrcsetCandidates.push(assets.largeWebp + ' ' + assets.largeWidth + 'w');

    if (el.sourceAvif && avifSrcsetCandidates.length) {
      el.sourceAvif.srcset = avifSrcsetCandidates.join(', ');
      el.sourceAvif.sizes = '100vw';
    }
    if (el.sourceWebp && webpSrcsetCandidates.length) {
      el.sourceWebp.srcset = webpSrcsetCandidates.join(', ');
      el.sourceWebp.sizes = '100vw';
    }

    el.image.src = assets.largeJpg || assets.mediumJpg || '';
    el.image.alt = entry.displayTitle || 'Photograph';
    el.image.style.opacity = '1';

    el.overlay.removeAttribute('hidden');
    document.body.classList.add('mobile-lightbox-open');

    // Preload adjacent entries
    preloadAdjacent(index);
  }

  function closeLightbox() {
    var el = getLightboxElements();
    el.overlay.setAttribute('hidden', '');
    document.body.classList.remove('mobile-lightbox-open');
    currentIndex = -1;
  }

  function navigateLightbox(direction) {
    var newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = entries.length - 1;
    if (newIndex >= entries.length) newIndex = 0;

    var el = getLightboxElements();
    var img = el.image;

    // Fade out
    img.style.opacity = '0';

    setTimeout(function () {
      openLightbox(newIndex);
      // Force fade in after DOM update
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          var img = el.image;
          // If image is already loaded or has naturalWidth, fade in
          if (img.naturalWidth > 0) {
            img.style.opacity = '1';
          } else {
            // Wait for load
            img.addEventListener('load', function () {
              img.style.opacity = '1';
            }, { once: true });
          }
        });
      });
    }, 150);
  }

  function preloadAdjacent(index) {
    var prevIndex = index - 1;
    var nextIndex = index + 1;

    if (prevIndex >= 0) {
      var prevJpg = entries[prevIndex].assets.mediumJpg;
      if (prevJpg) {
        var prevImg = new Image();
        prevImg.src = prevJpg;
      }
    }

    if (nextIndex < entries.length) {
      var nextJpg = entries[nextIndex].assets.mediumJpg;
      if (nextJpg) {
        var nextImg = new Image();
        nextImg.src = nextJpg;
      }
    }
  }

  /* ---- Event binding ---- */

  function bindGridClicks(grid) {
    grid.addEventListener('click', function (e) {
      var target = e.target;
      // Walk up to find the <img> with data-entry-index
      if (target.tagName === 'IMG' && target.hasAttribute('data-entry-index')) {
        var index = parseInt(target.getAttribute('data-entry-index'), 10);
        if (!isNaN(index)) {
          openLightbox(index);
        }
      }
    });
  }

  function bindLightboxEvents() {
    var el = getLightboxElements();

    // Close button
    el.close.addEventListener('click', function (e) {
      e.stopPropagation();
      closeLightbox();
    });

    // Backdrop tap to close
    el.media.addEventListener('click', function (e) {
      if (e.target === el.media || e.target.tagName === 'PICTURE') {
        closeLightbox();
      }
    });

    // Touch swipe handling
    el.overlay.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    el.overlay.addEventListener('touchend', function (e) {
      var endX = e.changedTouches[0].clientX;
      var endY = e.changedTouches[0].clientY;

      var diffX = touchStartX - endX;
      var diffY = touchStartY - endY;

      // Horizontal swipe: navigate
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > SWIPE_THRESHOLD) {
        if (diffX > 0) {
          navigateLightbox(1);  // swipe left → next
        } else {
          navigateLightbox(-1); // swipe right → prev
        }
      }
      // Swipe down: close
      else if (Math.abs(diffY) > Math.abs(diffX) && diffY < -SWIPE_THRESHOLD) {
        closeLightbox();
      }
    }, { passive: true });
  }

  /* ---- Init ---- */

  function showLoading(show) {
    var loading = document.getElementById('mobileGalleryLoading');
    if (loading) {
      if (show) loading.removeAttribute('hidden');
      else loading.setAttribute('hidden', '');
    }
  }

  function showError(msg) {
    var error = document.getElementById('mobileGalleryError');
    var loading = document.getElementById('mobileGalleryLoading');
    if (msg) {
      var p = error.querySelector('p');
      if (p) p.textContent = msg;
    }
    if (error) error.removeAttribute('hidden');
    if (loading) loading.setAttribute('hidden', '');
  }

  async function init() {
    var grid = document.getElementById('mobileGalleryGrid');
    if (!grid) return;

    bindLightboxEvents();

    try {
      var data = await loadData();
      entries = buildEntries(data.photos, data.sequenceItems);
    } catch (e) {
      console.error('Mobile gallery init failed:', e);
      showError('Gallery data could not be loaded.');
      return;
    }

    showLoading(false);

    if (!entries.length) {
      showError('No photographs found.');
      return;
    }

    renderGrid(grid, entries);
    bindGridClicks(grid);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
