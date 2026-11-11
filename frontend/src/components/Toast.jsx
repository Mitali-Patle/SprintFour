import { useEffect, useRef } from 'react';

const TONES = { success: '#16a34a', danger: '#dc2626', warning: '#d97706' };

export default function Toast({ toast, onDone, duration = 2500 }) {
  // Read the latest callback through a ref so a re-render doesn't restart the timer.
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => done.current(), duration);
    return () => clearTimeout(t);
  }, [toast, duration]);

  if (!toast) return null;
  return (
    <div className="toast" role="status" style={{ background: TONES[toast.tone] ?? TONES.success }}>
      {toast.msg}
    </div>
  );
}
