const $ = (id) => document.getElementById(id);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function api(path, body) {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status });
  return data;
}

function showLogin() {
  $('dash-view').hidden = true;
  $('login-view').hidden = false;
}

function showDashboard(account) {
  $('login-view').hidden = true;
  $('dash-view').hidden = false;
  $('create-account').hidden = !!account;
  $('start-interview').hidden = !account;
  $('greeting').hidden = !account;
  if (account) $('greeting').textContent = `Hi, ${account.firstName}`;
}

async function init() {
  try {
    const me = await api('/api/me');
    showDashboard(me.account);
  } catch {
    showLogin();
  }
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('login-error').textContent = '';
  try {
    await api('/api/login', { username: $('username').value, password: $('password').value });
    $('password').value = '';
    await init();
  } catch (err) {
    $('login-error').textContent = err.message;
  }
});

$('logout').addEventListener('click', async () => {
  await api('/api/logout', {});
  showLogin();
});

// Account modal
const validForm = () => $('first').value.trim() !== '' && EMAIL_RE.test($('email').value.trim());
const refreshDone = () => { $('done').disabled = !validForm(); };
['first', 'last', 'email'].forEach((id) => $(id).addEventListener('input', refreshDone));

$('create-account').addEventListener('click', () => {
  $('account-form').reset();
  $('account-error').textContent = '';
  refreshDone();
  $('modal').hidden = false;
  $('first').focus();
});

$('account-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validForm()) return;
  $('done').disabled = true;
  try {
    const { account } = await api('/api/account', {
      firstName: $('first').value, lastName: $('last').value, email: $('email').value,
    });
    $('modal').hidden = true;
    showDashboard(account);
  } catch (err) {
    $('account-error').textContent = err.message;
    refreshDone();
  }
});

init();
