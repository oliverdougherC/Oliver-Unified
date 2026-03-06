export class UIController {
  constructor({ entries, onSelectIndex }) {
    this.entries = entries;
    this.onSelectIndex = onSelectIndex;

    this.counterEl = document.getElementById('galleryCounter');
    this.captionEl = document.getElementById('galleryCaption');
    this.indexEl = document.getElementById('galleryIndex');
    this.indexListEl = document.getElementById('galleryIndexList');
    this.detailEl = document.getElementById('galleryDetail');
    this.detailTitleEl = document.getElementById('galleryDetailTitle');
    this.detailMetaEl = document.getElementById('galleryDetailMeta');
    this.indexToggleBtn = document.getElementById('galleryIndexToggle');
    this.infoToggleBtn = document.getElementById('galleryInfoToggle');
    this.actionsEl = document.querySelector('.gallery-actions');
    this.srDescEl = document.getElementById('gallerySrDesc');
    this.fallbackImgEl = document.getElementById('galleryFallbackImg');

    this.activeIndex = 0;
    this.indexButtons = [];
    this.captionPrefix = '';
    this.renderMode = 'initializing';
    this.isFocusMode = false;
    this.focusOverlayEl = null;
    this._onFocusExit = null;
    this._onFocusToggle = null;

    this.handleGlobalKey = this.handleGlobalKey.bind(this);
    this.handleListKeydown = this.handleListKeydown.bind(this);
    this.handleFocusOverlayClick = this.handleFocusOverlayClick.bind(this);

    this.buildIndex();
    this.bindEvents();
  }

  bindEvents() {
    this.indexToggleBtn?.addEventListener('click', () => {
      const shouldOpen = this.indexEl?.hasAttribute('hidden') ?? false;
      this.setIndexOpen(shouldOpen);
    });

    this.infoToggleBtn?.addEventListener('click', () => {
      const shouldOpen = this.detailEl?.hasAttribute('hidden') ?? false;
      this.setDetailOpen(shouldOpen);
    });

    this.indexListEl?.addEventListener('keydown', this.handleListKeydown);
    document.addEventListener('keydown', this.handleGlobalKey);
  }

  buildIndex() {
    if (!this.indexListEl) return;

    this.indexListEl.innerHTML = '';
    this.indexButtons.length = 0;

    for (let i = 0; i < this.entries.length; i += 1) {
      const entry = this.entries[i];
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gallery-index-item';
      button.dataset.index = String(i);

      const idxSpan = document.createElement('span');
      idxSpan.className = 'idx';
      idxSpan.textContent = String(i + 1).padStart(2, '0');

      const titleSpan = document.createElement('span');
      titleSpan.className = 'title';
      titleSpan.textContent = entry.title;

      button.appendChild(idxSpan);
      button.appendChild(titleSpan);

      button.addEventListener('click', () => {
        this.onSelectIndex(i);
      });

      li.appendChild(button);
      this.indexListEl.appendChild(li);
      this.indexButtons.push(button);
    }
  }

  setRenderMode(mode) {
    this.renderMode = mode;
  }

  setDepthState({ focused }) {
    const pushed = Boolean(focused);
    const targets = [
      this.actionsEl,
      this.counterEl,
      this.captionEl,
      this.indexEl,
      this.detailEl
    ];

    for (const target of targets) {
      target?.classList.toggle('is-depth-pushed', pushed);
    }
  }

  ensureFocusOverlay() {
    if (this.focusOverlayEl && document.body.contains(this.focusOverlayEl)) {
      return this.focusOverlayEl;
    }

    const overlay = document.createElement('div');
    overlay.id = 'galleryFocusOverlay';
    overlay.className = 'gallery-focus-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.addEventListener('click', this.handleFocusOverlayClick);

    const shell = document.getElementById('galleryShell') || document.body;
    shell.appendChild(overlay);
    this.focusOverlayEl = overlay;
    return overlay;
  }

  setFocusMode(active) {
    this.isFocusMode = Boolean(active);
    const overlay = this.ensureFocusOverlay();
    overlay.classList.toggle('is-active', this.isFocusMode);
    if (this.isFocusMode) {
      this.setDetailOpen(true);
    }
  }

  setActive(index, entry) {
    if (!this.entries.length) {
      this.activeIndex = 0;
      if (this.counterEl) {
        this.counterEl.textContent = '00 / 00';
      }
      if (this.captionEl) {
        this.captionEl.textContent = this.captionPrefix.trim() || 'No items';
      }
      return;
    }

    const boundedIndex = Math.min(Math.max(index, 0), this.entries.length - 1);
    const resolvedEntry = entry || this.entries[boundedIndex];

    this.activeIndex = boundedIndex;

    if (this.counterEl) {
      const current = String(boundedIndex + 1).padStart(2, '0');
      const total = String(this.entries.length).padStart(2, '0');
      this.counterEl.textContent = `${current} / ${total}`;
    }

    if (this.captionEl) {
      const label = resolvedEntry?.title || 'Untitled';
      this.captionEl.textContent = this.captionPrefix ? `${this.captionPrefix}${label}` : label;
    }

    for (let i = 0; i < this.indexButtons.length; i += 1) {
      this.indexButtons[i].classList.toggle('is-active', i === boundedIndex);
    }

    this.updateDetail(resolvedEntry);
    this.updateSrDescription(resolvedEntry);
    this.updateFallbackImage(resolvedEntry);
  }

  setCaptionPrefix(prefix) {
    this.captionPrefix = prefix || '';
    this.setActive(this.activeIndex, this.entries[this.activeIndex]);
  }

  updateDetail(entry) {
    if (!entry) return;

    if (this.detailTitleEl) {
      this.detailTitleEl.textContent = entry.title || 'Untitled';
    }

    if (!this.detailMetaEl) return;

    const metaRows = [
      ['Date', entry.meta?.date || 'N/A'],
      ['Lens', entry.meta?.lens || 'N/A'],
      ['Location', entry.meta?.location || 'N/A'],
      ['Notes', entry.meta?.notes || 'N/A']
    ];

    this.detailMetaEl.innerHTML = '';
    for (const [key, value] of metaRows) {
      const row = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = key;
      const dd = document.createElement('dd');
      dd.textContent = value;
      row.appendChild(dt);
      row.appendChild(dd);
      this.detailMetaEl.appendChild(row);
    }
  }

  updateSrDescription(entry) {
    if (!this.srDescEl || !entry) return;

    const parts = [entry.title || 'Untitled'];
    if (entry.meta?.location && entry.meta.location !== 'N/A') {
      parts.push(entry.meta.location);
    }
    if (entry.meta?.notes && entry.meta.notes !== 'N/A') {
      parts.push(entry.meta.notes);
    }
    this.srDescEl.textContent = `Photo: ${parts.join(' — ')}`;
  }

  updateFallbackImage(entry) {
    if (!this.fallbackImgEl || !entry) return;

    if (this.renderMode === 'fallback') {
      const src = entry.src?.medium || entry.src?.large || entry.src?.thumb || '';
      this.fallbackImgEl.src = src;
      this.fallbackImgEl.alt = entry.title || 'Gallery photo';
      this.fallbackImgEl.hidden = !src;
    } else {
      this.fallbackImgEl.hidden = true;
    }
  }

  setIndexOpen(open) {
    if (!this.indexEl || !this.indexToggleBtn) return;

    if (open) {
      this.indexEl.removeAttribute('hidden');
      this.indexToggleBtn.setAttribute('aria-expanded', 'true');
      const activeButton = this.indexButtons[this.activeIndex];
      activeButton?.focus();
    } else {
      this.indexEl.setAttribute('hidden', '');
      this.indexToggleBtn.setAttribute('aria-expanded', 'false');
    }
  }

  setDetailOpen(open) {
    if (!this.detailEl || !this.infoToggleBtn) return;

    if (open) {
      this.detailEl.removeAttribute('hidden');
      this.infoToggleBtn.setAttribute('aria-expanded', 'true');
    } else {
      this.detailEl.setAttribute('hidden', '');
      this.infoToggleBtn.setAttribute('aria-expanded', 'false');
    }
  }

  handleGlobalKey(event) {
    const activeEl = document.activeElement;
    const tag = activeEl?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || activeEl?.isContentEditable) {
      return;
    }

    const navOverlay = document.getElementById('navOverlay');
    if (navOverlay?.classList.contains('active')) {
      return;
    }

    if (event.key === 'i' || event.key === 'I') {
      event.preventDefault();
      const shouldOpen = this.indexEl?.hasAttribute('hidden') ?? false;
      this.setIndexOpen(shouldOpen);
      return;
    }

    if (event.key === 'd' || event.key === 'D') {
      event.preventDefault();
      const shouldOpen = this.detailEl?.hasAttribute('hidden') ?? false;
      this.setDetailOpen(shouldOpen);
      return;
    }

    if (event.key === 'Escape') {
      if (this.isFocusMode) {
        event.preventDefault();
        this._onFocusExit?.();
        return;
      }
      this.setIndexOpen(false);
      this.setDetailOpen(false);
      return;
    }

    if (event.key === 'Enter' && tag !== 'BUTTON' && tag !== 'A') {
      event.preventDefault();
      this._onFocusToggle?.();
      return;
    }

    if (!this.entries.length) return;

    if (event.key === 'ArrowRight' || event.key === 'PageDown') {
      event.preventDefault();
      const next = Math.min(this.entries.length - 1, this.activeIndex + 1);
      this.onSelectIndex(next);
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault();
      const prev = Math.max(0, this.activeIndex - 1);
      this.onSelectIndex(prev);
    }
  }

  handleListKeydown(event) {
    const idx = this.indexButtons.indexOf(document.activeElement);
    if (idx < 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = Math.min(this.indexButtons.length - 1, idx + 1);
      this.indexButtons[next].focus();
      this.onSelectIndex(next);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const next = Math.max(0, idx - 1);
      this.indexButtons[next].focus();
      this.onSelectIndex(next);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onSelectIndex(idx);
    }
  }

  handleFocusOverlayClick() {
    if (!this.isFocusMode) return;
    this._onFocusExit?.();
  }

  dispose() {
    document.removeEventListener('keydown', this.handleGlobalKey);
    this.indexListEl?.removeEventListener('keydown', this.handleListKeydown);
    if (this.focusOverlayEl) {
      this.focusOverlayEl.removeEventListener('click', this.handleFocusOverlayClick);
      this.focusOverlayEl.remove();
      this.focusOverlayEl = null;
    }
  }
}
