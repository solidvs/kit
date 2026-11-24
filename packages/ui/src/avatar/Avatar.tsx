import { Avatar as AvatarPrimitive } from '@base-ui/react/avatar';
import type { CSSProperties, MouseEventHandler } from 'react';

import { Glyph } from '../icons/Icon';
import './avatar.css';

export type AvatarSize = 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge';

/** Diameter of the picture, in pixels, per size; the white ring adds 2px on each side. */
export const AVATAR_SIZES: Record<AvatarSize, number> = {
  xsmall: 16,
  small: 24,
  medium: 32,
  large: 40,
  xlarge: 96,
  xxlarge: 128,
};

export type AvatarProps = {
  size?: AvatarSize;
  /** `circle` for people, `square` for projects and other things. */
  appearance?: 'circle' | 'square';
  /**
   * Accessible name (the person's or the project's name). Without it the avatar is decorative,
   * for example when the surrounding button already names it.
   */
  name?: string;
  /** Picture URL. Without it, or while it loads or if it fails, a default glyph is shown. */
  src?: string;
  /** Makes the avatar a button. */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** Makes the avatar a link. */
  href?: string;
  testId?: string;
  className?: string;
  style?: CSSProperties;
};

/** Picture of a person (circle) or a project (square), with a neutral glyph when there is no image. */
export function Avatar({
  size = 'medium',
  appearance = 'circle',
  name,
  src,
  onClick,
  href,
  testId,
  className,
  style,
}: AvatarProps) {
  const px = AVATAR_SIZES[size];
  const interactive = Boolean(onClick || href);
  const label = name || undefined;
  const frame = onClick ? (
    <button type="button" onClick={onClick} aria-label={label} />
  ) : href ? (
    <a href={href} aria-label={label} />
  ) : undefined;
  return (
    <div
      className={['ui-avatar', `ui-avatar--${appearance}`, className].filter(Boolean).join(' ')}
      data-testid={testId}
      style={{ '--ui-avatar-size': `${px}px`, ...style } as CSSProperties}
      {...(interactive ? {} : label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <AvatarPrimitive.Root className="ui-avatar__frame" render={frame}>
        {src && <AvatarPrimitive.Image className="ui-avatar__image" src={src} alt="" />}
        <AvatarPrimitive.Fallback className="ui-avatar__fallback">
          <Glyph
            glyph={appearance === 'square' ? 'ProjectAvatar' : 'Person'}
            label=""
            viewBox="-4 -4 24 24"
            pixelSize={px}
          />
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
    </div>
  );
}
