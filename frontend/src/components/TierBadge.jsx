import Pill from './Pill';
import { TIER_META } from '../lib/meta';

// Detection risk tier (red / yellow / green), optionally with its reason.
export default function TierBadge({ tier, reason, size }) {
  const meta = TIER_META[tier] ?? TIER_META.yellow;
  return (
    <Pill color={meta.color} size={size} title={reason ? `${meta.label}: ${reason}` : meta.label}>
      {meta.label}
      {reason && <span style={{ fontWeight: 400, opacity: 0.85 }}>· {reason}</span>}
    </Pill>
  );
}
