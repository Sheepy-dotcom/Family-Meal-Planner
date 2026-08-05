import { useEffect, useRef } from 'react';

/**
 * Keyboard behaviour every modal in the app needs.
 *
 * Before this, the only way to close a sheet was to click the backdrop or find
 * the Close button with a mouse. A keyboard user who opened one was stuck in
 * it, and a screen-reader user could tab straight out of the dialog into the
 * page behind while it was still covering the screen. Both are basic failures
 * and both were present in all six sheets.
 *
 * Three things happen here:
 *  - Escape closes, which is what everyone expects and costs nothing.
 *  - Focus moves into the dialog on open and returns to wherever it was on
 *    close, so you don't lose your place.
 *  - Tab cycles within the dialog rather than escaping behind it.
 */
export function useModal(onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;

    const node = ref.current;
    if (node) {
      const first = node.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      // Focus the dialog itself rather than its first control, so a screen
      // reader announces the dialog's label before its contents.
      (node as HTMLElement).focus?.();
      if (!node.contains(document.activeElement)) first?.focus();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !ref.current) return;

      const focusable = Array.from(
        ref.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    // The page behind must not scroll under an open sheet.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      (previouslyFocused.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  return ref;
}
