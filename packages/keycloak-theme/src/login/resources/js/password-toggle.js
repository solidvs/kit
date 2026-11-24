// Show / hide password button of the sign-in form. Works without it: the field stays a password field.
document.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('[data-password-toggle]') : null;
  if (!button) return;
  const input = document.getElementById(button.getAttribute('aria-controls'));
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  button.setAttribute('aria-pressed', String(show));
  button.setAttribute('aria-label', show ? button.dataset.labelHide : button.dataset.labelShow);
});
