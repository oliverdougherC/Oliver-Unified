/**
 * Shared footer-year utility and global color-mode toggle.
 */

const COLOR_MODE_STORAGE_KEY = 'od-color-mode';
const COLOR_MODE_DARK = 'dark';
const COLOR_MODE_LIGHT = 'light';

applyColorMode(getInitialColorMode());

document.addEventListener('DOMContentLoaded', () => {
  setCurrentYear();
  initColorModeToggle();
  window.addEventListener('storage', handleColorModeStorageSync);
});

function setCurrentYear() {
  const currentYear = String(new Date().getFullYear());
  document.querySelectorAll('[data-current-year]').forEach((el) => {
    el.textContent = currentYear;
  });
}

function getInitialColorMode() {
  const storedColorMode = readStoredColorMode();
  if (storedColorMode) return storedColorMode;
  return COLOR_MODE_DARK;
}

function readStoredColorMode() {
  try {
    const stored = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    if (stored === COLOR_MODE_DARK || stored === COLOR_MODE_LIGHT) {
      return stored;
    }
  } catch (_error) {
    // Ignore storage failures (privacy modes / blocked storage).
  }

  return null;
}

function persistColorMode(mode) {
  try {
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
  } catch (_error) {
    // Ignore storage failures.
  }
}

function applyColorMode(mode) {
  const normalizedMode = mode === COLOR_MODE_LIGHT ? COLOR_MODE_LIGHT : COLOR_MODE_DARK;
  document.documentElement.setAttribute('data-color-mode', normalizedMode);
  document.documentElement.style.colorScheme = normalizedMode;
}

function getAppliedColorMode() {
  const applied = document.documentElement.getAttribute('data-color-mode');
  return applied === COLOR_MODE_LIGHT ? COLOR_MODE_LIGHT : COLOR_MODE_DARK;
}

function handleColorModeStorageSync(event) {
  if (event.key !== COLOR_MODE_STORAGE_KEY) return;

  const nextMode = event.newValue === COLOR_MODE_LIGHT ? COLOR_MODE_LIGHT : COLOR_MODE_DARK;
  applyColorMode(nextMode);
  syncColorModeToggleLabels(nextMode);
}

function initColorModeToggle() {
  const mount = findColorModeToggleMount();
  if (!mount) return;
  if (document.querySelector('.theme-toggle')) return;

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = 'theme-toggle';
  toggleButton.setAttribute('data-cursor', 'hover');
  toggleButton.innerHTML =
    '<span class="theme-toggle-icon" aria-hidden="true"></span><span class="theme-toggle-text"></span>';

  toggleButton.addEventListener('click', () => {
    const currentMode = getAppliedColorMode();
    const nextMode = currentMode === COLOR_MODE_LIGHT ? COLOR_MODE_DARK : COLOR_MODE_LIGHT;
    applyColorMode(nextMode);
    persistColorMode(nextMode);
    syncColorModeToggleLabels(nextMode);
  });

  if (mount.type === 'shared-nav') {
    const navToggleButton = mount.element.querySelector('#navToggle, .nav-toggle');
    if (navToggleButton) {
      let navControls = mount.element.querySelector('.nav-controls');
      if (!navControls) {
        navControls = document.createElement('div');
        navControls.className = 'nav-controls';
        mount.element.insertBefore(navControls, navToggleButton);
        navControls.appendChild(navToggleButton);
      }

      navControls.insertBefore(toggleButton, navToggleButton);
    } else {
      mount.element.appendChild(toggleButton);
    }
  } else {
    mount.element.appendChild(toggleButton);
  }

  syncColorModeToggleLabels(getAppliedColorMode());
}

function findColorModeToggleMount() {
  const sharedNav = document.querySelector('.nav-inner');
  if (sharedNav) {
    return { type: 'shared-nav', element: sharedNav };
  }

  const abstractNavLinks = document.querySelector('.abstract-nav .nav-links');
  if (abstractNavLinks) {
    return { type: 'abstract-nav', element: abstractNavLinks };
  }

  const galleryActions = document.querySelector('.gallery-actions');
  if (galleryActions) {
    return { type: 'gallery-actions', element: galleryActions };
  }

  return null;
}

function syncColorModeToggleLabels(mode) {
  const toggleButtons = document.querySelectorAll('.theme-toggle');
  const nextMode = mode === COLOR_MODE_LIGHT ? COLOR_MODE_DARK : COLOR_MODE_LIGHT;

  toggleButtons.forEach((button) => {
    const label = button.querySelector('.theme-toggle-text');
    if (label) {
      label.textContent = nextMode === COLOR_MODE_LIGHT ? 'Light' : 'Dark';
    }

    button.setAttribute('aria-pressed', String(mode === COLOR_MODE_LIGHT));
    button.setAttribute('aria-label', `Switch to ${nextMode} mode`);
    button.dataset.mode = mode;
  });
}
