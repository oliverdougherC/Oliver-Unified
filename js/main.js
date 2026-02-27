/**
 * Oliver Dougherty - Main JavaScript (shared)
 * Handles navigation, scroll animations, smooth scroll, and portal glow.
 * Loaded on all pages as the shared base.
 */

document.addEventListener('DOMContentLoaded', () => {
  initMotionPreference();
  initNavigation();
  initScrollAnimations();
  initSmoothScroll();
  initPortalGlow();
});

/**
 * Honor reduced-motion preference globally.
 */
function initMotionPreference() {
  if (prefersReducedMotion()) {
    document.documentElement.classList.add('reduced-motion');
  }
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Navigation functionality (shared across all pages)
 */
function initNavigation() {
  const nav = document.getElementById('nav');
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  const mobileBreakpoint = 768;

  // Mobile menu toggle
  if (navToggle && navLinks) {
    const closeMobileNav = () => {
      navToggle.classList.remove('active');
      navLinks.classList.remove('active');
      navToggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    };

    navToggle.addEventListener('click', () => {
      const isActive = navLinks.classList.toggle('active');
      navToggle.classList.toggle('active');
      navToggle.setAttribute('aria-expanded', String(isActive));
      document.body.style.overflow = isActive ? 'hidden' : '';
    });

    // Close menu when clicking a link
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        closeMobileNav();
      });
    });

    // Reset menu state when returning to desktop width
    window.addEventListener('resize', debounce(() => {
      if (window.innerWidth > mobileBreakpoint) {
        closeMobileNav();
      }
    }, 120));
  }

  // Scroll behavior for nav background (landing page only)
  if (nav) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    }, { passive: true });
  }
}

/**
 * Scroll-triggered animations using Intersection Observer
 */
function initScrollAnimations() {
  const animatedElements = document.querySelectorAll('[data-animate]');

  if (!animatedElements.length) return;

  if (prefersReducedMotion()) {
    animatedElements.forEach((el) => {
      el.classList.add('visible');
    });
    return;
  }

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -10% 0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target); // Clean up after animation
      }
    });
  }, observerOptions);

  animatedElements.forEach(el => observer.observe(el));
}

/**
 * Smooth scroll for anchor links
 */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');

      if (href === '#') return;

      const target = document.querySelector(href);

      if (target) {
        e.preventDefault();

        const navHeight = document.querySelector('.nav')?.offsetHeight || 0;
        const targetPosition = target.getBoundingClientRect().top + window.scrollY - navHeight - 20;

        if (prefersReducedMotion()) {
          window.scrollTo(0, targetPosition);
        } else {
          smoothScrollTo(targetPosition, 1200);
        }
      }
    });
  });
}

/**
 * Custom smooth scroll with eased duration
 */
function smoothScrollTo(targetY, duration) {
  if (prefersReducedMotion()) {
    window.scrollTo(0, targetY);
    return;
  }

  const startY = window.scrollY;
  const distance = targetY - startY;
  let startTime = null;

  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeInOutCubic(progress);

    window.scrollTo(0, startY + distance * eased);

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

/**
 * Utility: Debounce function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Utility: Throttle function
 */
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Portal card cursor-following glow effect (landing page only)
 * Throttled with requestAnimationFrame to avoid excessive reflows
 */
function initPortalGlow() {
  const portalCards = document.querySelectorAll('.portal-card');

  if (!portalCards.length) return;
  if (prefersReducedMotion()) return;

  portalCards.forEach(card => {
    const portalBg = card.querySelector('.portal-bg');
    let rafPending = false;

    card.addEventListener('mousemove', (e) => {
      if (rafPending) return;
      rafPending = true;

      requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
        rafPending = false;
      });
    });

    card.addEventListener('mouseleave', () => {
      if (portalBg) {
        portalBg.style.transition = 'opacity 400ms ease';
        portalBg.style.opacity = '0';
        setTimeout(() => {
          card.style.setProperty('--mouse-x', '50%');
          card.style.setProperty('--mouse-y', '50%');
          portalBg.style.transition = '';
          portalBg.style.opacity = '';
        }, 400);
      }
    });
  });
}
