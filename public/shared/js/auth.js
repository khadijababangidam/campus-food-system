/**
 * Handles the login form and redirects each role to its own area
 * after a successful login. Registration form (register.html) follows
 * the same pattern and isn't duplicated here.
 */
(function () {
  const form = document.getElementById('loginForm');
  if (!form) return;

  const alertBox = document.getElementById('loginAlert');
  const loginBtn = document.getElementById('loginBtn');

  const ROLE_HOME = {
    student: '/student/dashboard.html',
    staff: '/student/dashboard.html', // staff shares the student ordering UI
    vendor: '/vendor/dashboard.html',
    rider: '/rider/dashboard.html',
    admin: '/admin/dashboard.html',
  };

  function showError(message) {
    alertBox.textContent = message;
    alertBox.classList.remove('d-none');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.classList.add('d-none');
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in…';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const { data } = await window.GSUApi.apiRequest('/auth/login', {
        method: 'POST',
        auth: false,
        body: { email, password },
      });

      window.GSUApi.setToken(data.token);
      sessionStorage.setItem('gsu_food_user', JSON.stringify(data.user));

      const destination = ROLE_HOME[data.user.role] || '/shared/login.html';
      window.location.href = destination;
    } catch (err) {
      showError(err.message || 'Login failed. Please try again.');
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    }
  });
})();
