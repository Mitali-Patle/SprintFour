import Pill from './Pill';
import { WORKFLOW_META } from '../lib/meta';

// Review lifecycle: Needs Review / In Progress / Cleared.
export default function StatusBadge({ status }) {
  const meta = WORKFLOW_META[status] ?? WORKFLOW_META.needs_review;
  return <Pill color={meta.color} title="Review status">{meta.label}</Pill>;
}
