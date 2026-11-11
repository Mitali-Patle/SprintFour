const SHORTCUTS = [
  ['a', 'accept'],
  ['r', 'reject'],
  ['j / k', 'next / previous suggestion'],
  ['f', 'finalize'],
  ['n', 'next document'],
  ['Esc', 'dashboard'],
];

export default function KeyboardHint() {
  return (
    <p className="keyboard-hint">
      {SHORTCUTS.map(([key, label], i) => (
        <span key={key}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          <kbd>{key}</kbd> {label}
        </span>
      ))}
    </p>
  );
}
