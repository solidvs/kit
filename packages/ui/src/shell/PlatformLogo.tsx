import './platform-logo.css';

/**
 * Platform mark used in the top navigation. Placeholder until the platform brand exists; it must never
 * reuse a third-party logo or product name.
 */
export function PlatformIcon() {
  return (
    <svg className="ui-platform-icon" width="24" height="24" viewBox="0 0 24 24" role="presentation" focusable="false">
      <rect className="ui-platform-icon__tile" width="24" height="24" rx="6" />
      <path className="ui-platform-icon__letter" d="M8 6.5h5a3.75 3.75 0 0 1 0 7.5h-2.5v3.5H8z" />
    </svg>
  );
}

/** Mark plus name, shown at the start of the top navigation on wide screens. */
export function PlatformLogo() {
  return (
    <span className="ui-platform-logo">
      <PlatformIcon />
      <span className="ui-platform-logo__name">Plataforma</span>
    </span>
  );
}
