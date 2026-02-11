/**
 * Archive (Neurophasia) JavaScript
 * Handles search and filtering. Navigation and scroll animations
 * are provided by main.js (loaded before this script).
 */

document.addEventListener('DOMContentLoaded', () => {
  initSearch();
  initFilters();
});

/**
 * Search functionality
 */
function initSearch() {
  const searchInput = document.getElementById('searchInput');
  const cards = document.querySelectorAll('.report-card');
  const noResults = document.getElementById('noResults');

  if (!searchInput) return;

  searchInput.addEventListener('input', debounce((e) => {
    const query = e.target.value.toLowerCase().trim();

    // Reset filter buttons
    document.querySelectorAll('.filter-tag').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector('.filter-tag[data-filter="all"]')?.classList.add('active');

    let visibleCount = 0;

    cards.forEach(card => {
      const title = card.querySelector('.report-title')?.textContent.toLowerCase() || '';
      const desc = card.querySelector('.report-desc')?.textContent.toLowerCase() || '';
      const category = card.querySelector('.report-category')?.textContent.toLowerCase() || '';

      const matches = !query ||
        title.includes(query) ||
        desc.includes(query) ||
        category.includes(query);

      if (matches) {
        card.classList.remove('hidden');
        visibleCount++;
      } else {
        card.classList.add('hidden');
      }
    });

    if (noResults) {
      noResults.style.display = visibleCount === 0 ? 'block' : 'none';
    }
  }, 200));
}

/**
 * Category filtering
 */
function initFilters() {
  const filterButtons = document.querySelectorAll('.filter-tag');
  const cards = document.querySelectorAll('.report-card');
  const searchInput = document.getElementById('searchInput');
  const noResults = document.getElementById('noResults');

  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter;

      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      if (searchInput) searchInput.value = '';

      let visibleCount = 0;

      cards.forEach(card => {
        const category = card.dataset.category;

        if (filter === 'all' || category === filter) {
          card.classList.remove('hidden');
          visibleCount++;
        } else {
          card.classList.add('hidden');
        }
      });

      if (noResults) {
        noResults.style.display = visibleCount === 0 ? 'block' : 'none';
      }
    });
  });
}
