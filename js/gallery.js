import { App } from './gallery3d/App.js';

function bootstrapGallery() {
  const app = new App({
    canvasSelector: '#galleryWebglCanvas',
    shellSelector: '#galleryShell',
    scrollTrackSelector: '#galleryScrollTrack'
  });

  window.__galleryApp = app;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapGallery, { once: true });
} else {
  bootstrapGallery();
}
