import type { CSSProperties } from 'react';

import { Avatar, AVATAR_SIZES, type AvatarSize } from './Avatar';
import './avatar-group.css';

export type AvatarGroupItem = {
  name: string;
  key?: string | number;
  src?: string;
};

export type AvatarGroupProps = {
  /** `stack` overlaps the avatars in one row; `grid` lays them out in wrapping rows. */
  appearance?: 'stack' | 'grid';
  size?: AvatarSize;
  data: AvatarGroupItem[];
  /** Largest number of avatars shown; the rest are summarized as "+N". */
  maxCount?: number;
  /** Accessible name of the list. */
  label?: string;
  testId?: string;
  className?: string;
};

/** Row of people avatars, for example the members of a project. */
export function AvatarGroup({
  appearance = 'stack',
  size = 'medium',
  data,
  maxCount,
  label = 'Grupo de avatares',
  testId,
  className,
}: AvatarGroupProps) {
  const limit = maxCount !== undefined && data.length > maxCount ? Math.max(maxCount - 1, 0) : data.length;
  const shown = data.slice(0, limit);
  const hidden = data.length - shown.length;
  const px = AVATAR_SIZES[size];
  return (
    <ul
      className={['ui-avatar-group', `ui-avatar-group--${appearance}`, className].filter(Boolean).join(' ')}
      aria-label={label}
      data-testid={testId}
      style={{ '--ui-avatar-size': `${px}px` } as CSSProperties}
    >
      {shown.map((item, index) => (
        <li
          key={item.key ?? `${item.name}-${index}`}
          className="ui-avatar-group__item"
          style={appearance === 'stack' ? { zIndex: shown.length - index + 1 } : undefined}
        >
          <Avatar size={size} name={item.name} src={item.src} />
        </li>
      ))}
      {hidden > 0 && (
        <li className="ui-avatar-group__item">
          <span className="ui-avatar-group__more" role="img" aria-label={`Mais ${hidden}`}>
            <span className="ui-avatar-group__more-frame" aria-hidden="true">
              +{hidden}
            </span>
          </span>
        </li>
      )}
    </ul>
  );
}
