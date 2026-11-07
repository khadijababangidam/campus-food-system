/**
 * Shared API client — every page's JS should call requests through here
 * instead of using fetch() directly, so auth headers and error handling
 * stay consistent across all four role interfaces.
 */
const API_BASE_URL = '/api/v1';

function getToken() {
  return sessionStorage.getItem('gsu_food_token');
}

function setToken(token) {
  sessionStorage.setItem('gsu_food_token', token);
}

function clearToken() {
  sessionStorage.removeItem('gsu_food_token');
}

async function apiRequest(path, { method = 'GET', body = null, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    // Catches severe network failures (e.g., server offline, no internet connection)
    throw new Error('Network error: Could not connect to the server.');
  }

  // Safely attempt to parse the JSON response
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Session expired or invalid — send the user back to login.
    if (response.status === 401) {
      clearToken();
      window.location.href = '/shared/login.html';
    }
    
    // Construct a detailed error object to pass back to the UI
    const error = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.errors = data.errors;
    throw error;
  }

  return data;
}

// Exposed as a small global namespace — no bundler/module system needed,
// consistent with the vanilla-JS, no-build-step approach chosen in Ch.3.
window.GSUApi = { apiRequest, getToken, setToken, clearToken };