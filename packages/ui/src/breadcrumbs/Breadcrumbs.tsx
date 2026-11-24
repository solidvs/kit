import { Children, isValidElement, type MouseEventHandler, type ReactNode } from 'react';

import './breadcrumbs.css';

export type BreadcrumbsProps = {
  /** `BreadcrumbsItem` elements, from the outermost level to the current page. */
  children: ReactNode;
  /** Accessible name of the navigation landmark. */
  label?: string;
  testId?: string;
};

export type BreadcrumbsItemProps = {
  text: string;
  href?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  testId?: string;
  /** Set by `Breadcrumbs` on the last item. */
  isCurrent?: boolean;
};

/** Path from the outermost level to the current page; the last item is the current page. */
export function Breadcrumbs({ children, label = 'Trilha de navegação', testId }: BreadcrumbsProps) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <nav className="ui-breadcrumbs" aria-label={label} data-testid={testId}>
      <ol className="ui-breadcrumbs__list">
        {items.map((item, index) => (
          <li key={item.key ?? index} className="ui-breadcrumbs__item">
            {index === items.length - 1 ? withCurrent(item) : item}
            {index < items.length - 1 && (
              <span className="ui-breadcrumbs__separator" aria-hidden>
                /
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function withCurrent(item: ReactNode): ReactNode {
  if (!isValidElement<BreadcrumbsItemProps>(item) || item.type !== BreadcrumbsItem) return item;
  return <BreadcrumbsItem {...item.props} isCurrent />;
}

/** One level of the path. */
export function BreadcrumbsItem({ text, href, onClick, testId, isCurrent = false }: BreadcrumbsItemProps) {
  return (
    <a
      className="ui-breadcrumbs__link"
      href={href}
      onClick={onClick}
      aria-current={isCurrent ? 'page' : undefined}
      data-testid={testId}
    >
      <span className="ui-breadcrumbs__text">{text}</span>
    </a>
  );
}
