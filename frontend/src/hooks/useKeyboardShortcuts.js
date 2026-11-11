import { useEffect, useRef } from 'react';

// Buttons are deliberately not listed: after clicking "Accept" focus stays on the
// button, and letter shortcuts must keep working from there.
const INTERACTIVE = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Binds single-key shortcuts to the window.
 *
 * Ignores modified keys (so Ctrl+R still reloads and Ctrl+F still finds),
 * auto-repeat, and keys typed into form controls. Always calls the latest
 * handlers without re-binding on every render.
 *
 * @param {Record<string, () => void>} bindings
 * @param {boolean} enabled
 */
export default function useKeyboardShortcuts(bindings, enabled = true) {
  const latest = useRef(bindings);
  useEffect(() => { latest.current = bindings; });

  useEffect(() => {
    if (!enabled) return undefined;
    function onKeyDown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (INTERACTIVE.has(e.target.tagName) || e.target.isContentEditable) return;
      const handler = latest.current[e.key.toLowerCase()];
      if (!handler) return;
      e.preventDefault();
      handler();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
