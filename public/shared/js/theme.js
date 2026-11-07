/**
 * Global Theme Manager
 * Handles switching between Dark and Light modes, persisting the 
 * user's preference in localStorage so it persists across pages.
 */
(function() {
  const THEME_KEY = 'gsu_food_theme';
  
  // Default to our premium dark mode if they haven't set a preference
  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  
  // Apply immediately to prevent a white-flash on page load
  document.documentElement.setAttribute('data-bs-theme', savedTheme);

  // Wait for the DOM to load before wiring up the toggle button
  document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeIcon = document.getElementById('themeIcon');

    function updateIcon(theme) {
      if (!themeIcon) return;
      if (theme === 'dark') {
        themeIcon.className = 'bi bi-moon-stars-fill text-warning';
      } else {
        themeIcon.className = 'bi bi-sun-fill text-warning';
      }
    }

    // Set initial icon state
    updateIcon(savedTheme);

    // Bind click event if the button exists on this page
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-bs-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        // Update DOM, Storage, and Icon
        document.documentElement.setAttribute('data-bs-theme', newTheme);
        localStorage.setItem(THEME_KEY, newTheme);
        updateIcon(newTheme);
      });
    }
  });
})();