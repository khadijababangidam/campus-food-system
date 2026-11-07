/**
 * Client-side guard: redirects to login if no token is present.
 * This is a UX convenience only, NOT a security boundary — the real
 * authorization check happens server-side via middleware/auth.js on
 * every protected API route. A user could disable this script and it
 * would change nothing about what the API allows them to do.
 */
(function () {
  const token = window.GSUApi ? window.GSUApi.getToken() : sessionStorage.getItem('gsu_food_token');
  if (!token) {
    window.location.href = '/shared/login.html';
  }
})();
