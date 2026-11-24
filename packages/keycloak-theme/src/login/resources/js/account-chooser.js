// Remembered account of the sign-in page. Only the user name is kept, in this browser's storage for
// the identity provider's address; never the password, never a session. Without this script (or with
// nothing remembered) the plain form is shown.
(() => {
  const KEY = 'platform.rememberedAccount';
  const HUES = ['blue', 'teal', 'green', 'purple', 'magenta', 'orange', 'red'];
  const form = document.querySelector('form[data-account-chooser]');
  if (!form) return;

  const read = () => {
    try {
      return window.localStorage.getItem(KEY) || '';
    } catch {
      return '';
    }
  };
  const write = (value) => {
    try {
      if (value) window.localStorage.setItem(KEY, value);
      else window.localStorage.removeItem(KEY);
    } catch {
      // Storage unavailable: the plain form keeps working.
    }
  };

  const username = form.querySelector('#username');
  const password = form.querySelector('#password');
  const remember = form.querySelector('#rememberAccount');
  const rememberRow = form.querySelector('[data-remember]');
  const account = form.querySelector('[data-account]');
  const choices = form.querySelector('[data-choices]');
  const saved = read();

  if (rememberRow) rememberRow.hidden = false;
  if (remember) remember.checked = Boolean(saved);

  // Remember (or forget) the account when the form is sent.
  form.addEventListener('submit', () => {
    write(remember?.checked && username?.value ? username.value.trim() : '');
  });

  const showTitle = (signIn) => {
    document.querySelectorAll('[data-title-choose]').forEach((el) => (el.hidden = signIn));
    document.querySelectorAll('[data-title-sign-in]').forEach((el) => (el.hidden = !signIn));
  };

  // A failed attempt shows the plain form with what the user typed.
  if (!saved || form.hasAttribute('data-invalid') || !account || !choices) return;

  const hue = HUES[[...saved].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % HUES.length];
  const initial = form.querySelector('[data-account-initial]');
  if (initial) {
    initial.textContent = saved.charAt(0).toUpperCase();
    initial.classList.add(`ui-login__avatar--${hue}`);
  }
  const name = form.querySelector('[data-account-name]');
  if (name) name.textContent = saved;
  if (username) username.value = saved;
  account.hidden = false;
  choices.hidden = false;
  form.dataset.step = 'choose';
  showTitle(false);

  form.addEventListener('click', (event) => {
    const choice = event.target instanceof Element ? event.target.closest('[data-choice]')?.dataset.choice : null;
    if (!choice) return;
    if (choice === 'continue') {
      form.dataset.step = 'password';
      showTitle(true);
      password?.focus();
      return;
    }
    if (choice === 'remove') {
      write('');
      if (remember) remember.checked = false;
    }
    form.dataset.step = 'form';
    if (username) username.value = '';
    showTitle(true);
    username?.focus();
  });
})();
