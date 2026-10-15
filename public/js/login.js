const form = document.getElementById('login');
const error = document.getElementById('login-error');
const button = form.querySelector('button');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  button.disabled = true;
  error.textContent = '';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: form.password.value }),
    });
    if (res.ok) return location.replace('/');
    error.textContent = (await res.json().catch(() => ({}))).error || 'Something went wrong. Try again.';
  } catch {
    error.textContent = "Can't reach the server. Check your connection and try again.";
  }
  button.disabled = false;
  form.password.select();
});
