import type { Priority } from '@/types';
import { PRIORITY_COLORS } from '@/lib/constants';

interface Props {
  priority: Priority;
}

export function PriorityBadge({ priority }: Props) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${PRIORITY_COLORS[priority]}`}
    >
      {priority}
    </span>
  );
}
