/**
 * Shared footer-year utility.
 * Replaces any [data-current-year] placeholder with the current calendar year.
 */

document.addEventListener('DOMContentLoaded', () => {
  const currentYear = String(new Date().getFullYear());

  document.querySelectorAll('[data-current-year]').forEach((el) => {
    el.textContent = currentYear;
  });
});
