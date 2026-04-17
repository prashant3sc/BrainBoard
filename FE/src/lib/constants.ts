import type { Role, Priority, IssueStatus } from '@/types';

export const PERMISSIONS: Record<string, Role[]> = {
  createProject:  ['admin', 'pm'],
  editIssue:      ['admin', 'pm', 'developer'],
  deleteIssue:    ['admin', 'pm'],
  moveIssue:      ['admin', 'pm', 'developer'],
  manageUsers:    ['admin'],
  createWikiPage: ['admin', 'pm', 'developer'],
  editWikiPage:   ['admin', 'pm', 'developer'],
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-yellow-100 text-yellow-700',
  low:      'bg-green-100 text-green-700',
};

export const STATUS_LABELS: Record<IssueStatus, string> = {
  todo:        'To Do',
  in_progress: 'In Progress',
  review:      'In Review',
  blocked:     'Blocked',
  done:        'Done',
};
