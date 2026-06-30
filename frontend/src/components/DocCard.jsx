import { useNavigate } from 'react-router-dom';
import StatusBadge from './StatusBadge';

const CATEGORY_LABELS = {
  employment_contract: 'Employment Contract',
  medical_report:      'Medical Report',
  court_affidavit:     'Court Affidavit',
  lease_agreement:     'Lease Agreement',
  financial_invoice:   'Financial Invoice',
};

export default function DocCard({ doc }) {
  const navigate  = useNavigate();
  const isCleared = doc.workflowStatus === 'cleared';
  const clickable = !isCleared; // open any document still in the workflow to review/finalize

  function handleClick() {
    if (clickable) navigate(`/review/${doc.id}`);
  }

  function handleKey(e) {
    if (clickable && (e.key === 'Enter' || e.key === ' ')) handleClick();
  }

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKey}
      style={{
        border:        '1px solid #e5e7eb',
        borderRadius:  10,
        padding:       '14px 16px',
        background:    isCleared ? '#f9fafb' : '#fff',
        cursor:        clickable ? 'pointer' : 'default',
        display:       'flex',
        flexDirection: 'column',
        gap:           8,
        transition:    'box-shadow 0.1s',
        outline:       'none',
      }}
      onMouseEnter={e => { if (clickable) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; }}
      onFocus={e     => { if (clickable) e.currentTarget.style.boxShadow = '0 0 0 2px #60a5fa'; }}
      onBlur={e      => { e.currentTarget.style.boxShadow = ''; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', flex: 1, lineHeight: 1.4 }}>
          {doc.title}
        </div>
        <StatusBadge status={doc.workflowStatus} />
      </div>

      <div style={{ fontSize: 12, color: '#6b7280' }}>
        {CATEGORY_LABELS[doc.category] || doc.category}
      </div>

      {doc.tierReason && (
        <div style={{
          fontSize:     12,
          color:        '#92400e',
          background:   '#fef3c7',
          padding:      '3px 8px',
          borderRadius: 4,
          lineHeight:   1.4,
        }}>
          {doc.tierReason}
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
        <span>{doc.spanCount} span{doc.spanCount !== 1 ? 's' : ''}</span>
        {doc.pendingCount > 0
          ? <span style={{ color: '#d97706', fontWeight: 600 }}>{doc.pendingCount} pending</span>
          : <span style={{ color: '#16a34a', fontWeight: 500 }}>✓ reviewed</span>
        }
      </div>
    </div>
  );
}
