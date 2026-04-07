import type { Issue } from '@/types';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { Avatar } from '@/components/common/Avatar';
import { mockUsers } from '@/mocks/users';

interface Props {
  issue: Issue;
  onClick: (issue: Issue) => void;
  isDragging?: boolean;
}

export function IssueCard({ issue, onClick, isDragging = false }: Props) {
  const assignee = mockUsers.find((u) => u.id === issue.assigneeId) ?? null;

  function handleClick() {
    onClick(issue);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className={`cursor-pointer rounded-lg border border-gray-200 bg-white p-3 space-y-2 transition-shadow focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
        isDragging ? 'shadow-lg rotate-1' : 'shadow-sm hover:shadow-md'
      }`}
    >
      <p className="text-sm font-medium text-gray-900 leading-snug">{issue.title}</p>

      <div className="flex items-center justify-between">
        <PriorityBadge priority={issue.priority} />
        <span className="text-xs text-gray-400 font-medium">{issue.storyPoints} pts</span>
      </div>

      {assignee && (
        <div className="flex items-center gap-1.5">
          <Avatar user={assignee} size="sm" />
          <span className="text-xs text-gray-500 truncate">{assignee.name}</span>
        </div>
      )}
    </div>
  );
}
