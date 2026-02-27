/**
 * Dashboard status checks.
 * Performs lightweight runtime availability checks for self-hosted services.
 */

const STATUS_TIMEOUT_MS = 4500;
const STATUS_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

document.addEventListener('DOMContentLoaded', () => {
  initServiceStatusChecks();
});

function initServiceStatusChecks() {
  const cards = Array.from(document.querySelectorAll('.service-card[data-health-url]'));
  if (!cards.length) return;

  const refreshButton = document.getElementById('servicesRefreshBtn');

  const runChecks = async () => {
    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.textContent = 'Checking...';
    }

    const results = await Promise.all(cards.map((card) => checkServiceCard(card)));

    updateStatusSummary(results);
    updateLastCheckedTime();

    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.textContent = 'Refresh Status';
    }
  };

  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      runChecks();
    });
  }

  runChecks();

  const intervalId = window.setInterval(runChecks, STATUS_REFRESH_INTERVAL_MS);
  window.addEventListener('beforeunload', () => {
    window.clearInterval(intervalId);
  }, { once: true });
}

async function checkServiceCard(card) {
  const healthUrl = card.dataset.healthUrl || card.href;
  const serviceName = card.querySelector('.service-name')?.textContent?.trim() || 'Service';

  setServiceStatus(card, {
    state: 'checking',
    label: 'Checking...',
    title: `${serviceName}: checking now`
  });

  const started = performance.now();

  try {
    await fetchWithTimeout(healthUrl, STATUS_TIMEOUT_MS);

    const latencyMs = Math.max(1, Math.round(performance.now() - started));

    setServiceStatus(card, {
      state: 'online',
      label: 'Online',
      title: `${serviceName}: online (${latencyMs}ms)`
    });

    return {
      state: 'online',
      latencyMs
    };
  } catch (_err) {
    setServiceStatus(card, {
      state: 'offline',
      label: 'Offline',
      title: `${serviceName}: offline`
    });

    return {
      state: 'offline',
      latencyMs: null
    };
  }
}

function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, {
    method: 'GET',
    mode: 'no-cors',
    cache: 'no-store',
    redirect: 'follow',
    signal: controller.signal
  }).finally(() => {
    window.clearTimeout(timeout);
  });
}

function setServiceStatus(card, status) {
  const badge = card.querySelector('[data-service-status]');
  if (!badge) return;

  badge.classList.remove('online', 'offline', 'checking');
  badge.classList.add(status.state);

  const textEl = badge.querySelector('.status-text');
  if (textEl) {
    textEl.textContent = status.label;
  } else {
    badge.textContent = status.label;
  }

  badge.title = status.title;
  badge.setAttribute('aria-label', status.title);
}

function updateStatusSummary(results) {
  const summaryEl = document.getElementById('servicesStatusSummary');
  if (!summaryEl) return;

  const total = results.length;
  const online = results.filter((result) => result.state === 'online');
  const offline = results.filter((result) => result.state === 'offline');

  let summary = `${online.length}/${total} services online`;

  if (offline.length > 0) {
    summary += `, ${offline.length} offline`;
  }

  if (online.length > 0) {
    const avgLatency = Math.round(
      online.reduce((sum, result) => sum + result.latencyMs, 0) / online.length
    );
    summary += ` · avg ${avgLatency}ms`;
  }

  summaryEl.textContent = summary;
}

function updateLastCheckedTime() {
  const lastCheckedEl = document.getElementById('servicesLastChecked');
  if (!lastCheckedEl) return;

  const now = new Date();
  const formatted = now.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  });

  lastCheckedEl.textContent = `Last checked: ${formatted}`;
}
