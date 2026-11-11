import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import TierBadge from './TierBadge';
import { CATEGORY_LABELS, PALETTE, TIER_META, plural } from '../lib/meta';

export default function DocCard({ doc }) {
  const tierColor = PALETTE[TIER_META[doc.tier]?.color ?? 'yellow'];

  return (
    <Link
      to={`/review/${doc.id}`}
      className="doc-card"
      style={{ borderLeft: `4px solid ${tierColor.dot}` }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', flex: 1, lineHeight: 1.4 }}>
          {doc.title}
        </div>
        <StatusBadge status={doc.workflowStatus} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <TierBadge tier={doc.tier} size={11} />
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {CATEGORY_LABELS[doc.category] || doc.category}
        </span>
      </div>

      {doc.tierReason && (
        <div style={{
          fontSize:     12,
          color:        tierColor.text,
          background:   tierColor.bg,
          padding:      '3px 8px',
          borderRadius: 4,
          lineHeight:   1.4,
        }}>
          {doc.tierReason}
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
        <span>{plural(doc.spanCount, 'span')}</span>
        {doc.recallCount > 0 && (
          <span style={{ color: '#b91c1c', fontWeight: 600 }}>{plural(doc.recallCount, 'possible miss', 'possible misses')}</span>
        )}
        {doc.pendingCount > 0
          ? <span style={{ color: '#d97706', fontWeight: 600 }}>{doc.pendingCount} pending</span>
          : <span style={{ color: '#16a34a', fontWeight: 500 }}>✓ reviewed</span>}
      </div>
    </Link>
  );
}
