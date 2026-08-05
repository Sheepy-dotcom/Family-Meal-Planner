import type { ReactNode, RefObject } from 'react';

/**
 * Lets a panel be either a modal sheet or a plain page.
 *
 * The same screens are reached two ways now: from a bottom tab, where they are
 * the whole page and closing makes no sense, and occasionally from a contextual
 * action, where a dismissable sheet is right. Rather than build each screen
 * twice, they render their contents and this decides the frame.
 */
export function Shell({
  variant,
  dialogRef,
  onClose,
  label,
  children,
}: {
  variant: 'sheet' | 'page';
  dialogRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  if (variant === 'page') {
    return (
      <section className="page" aria-label={label}>
        {children}
      </section>
    );
  }

  return (
    <div
      className="sheet__backdrop"
      ref={dialogRef}
      tabIndex={-1}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      {children}
    </div>
  );
}
