export default function KeyboardHint() {
  const kbdStyle = {
    display:      'inline-block',
    padding:      '0 5px',
    borderRadius: 4,
    border:       '1px solid #d1d5db',
    background:   '#f3f4f6',
    fontFamily:   'monospace',
    fontSize:     11,
    color:        '#374151',
    lineHeight:   '18px',
  };

  return (
    <p style={{ fontSize: 12, color: '#6b7280', margin: '-12px 0 16px', userSelect: 'none' }}>
      Shortcuts:&nbsp;
      <kbd style={kbdStyle}>a</kbd> accept&nbsp;&nbsp;·&nbsp;&nbsp;
      <kbd style={kbdStyle}>r</kbd> reject&nbsp;&nbsp;·&nbsp;&nbsp;
      <kbd style={kbdStyle}>n</kbd> next doc&nbsp;&nbsp;·&nbsp;&nbsp;
      <kbd style={kbdStyle}>f</kbd> finalize
    </p>
  );
}
