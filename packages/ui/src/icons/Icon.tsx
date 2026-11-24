import type { CSSProperties } from 'react';

import { GLYPHS, type GlyphName } from './glyphs';
import './icon.css';

export type IconProps = {
  /** Accessible name. Empty when the icon is decorative (its meaning is already in the text next to it). */
  label: string;
  /** Any CSS color; defaults to the surrounding text color. */
  color?: string;
  /** `medium` is 16 px, `small` is 12 px. */
  size?: 'medium' | 'small';
  testId?: string;
};

type GlyphProps = IconProps & {
  glyph: GlyphName;
  /** Draws the 16-unit glyph inside a larger box (used by avatars and the search field). */
  viewBox?: string;
  pixelSize?: number;
};

/** Renders one glyph of the platform icon set as inline SVG; no request, no `data:` URL. */
export function Glyph({ glyph, label, color = 'currentColor', size = 'medium', testId, viewBox = '0 0 16 16', pixelSize }: GlyphProps) {
  const px = pixelSize ?? (size === 'small' ? 12 : 16);
  const style = { color, '--ui-icon-size': `${px}px` } as CSSProperties;
  return (
    <span
      className="ui-icon"
      style={style}
      data-testid={testId}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <svg viewBox={viewBox} role="presentation" focusable="false" dangerouslySetInnerHTML={{ __html: GLYPHS[glyph] }} />
    </span>
  );
}

/** Creates the exported component of one icon name. */
export function createIcon(glyph: GlyphName, displayName: string) {
  const Icon = (props: IconProps) => <Glyph glyph={glyph} {...props} />;
  Icon.displayName = displayName;
  return Icon;
}
