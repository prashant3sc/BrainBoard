import type { Issue } from '../types';

export const mockIssues: Issue[] = [
  // --- todo (3) ---
  {
    id: 'issue-1',
    title: 'Implement CSV export for order history',
    description:
      'Add a "Export as CSV" button on the order history page that downloads a filtered dataset for the selected date range.',
    status: 'todo',
    priority: 'high',
    storyPoints: 5,
    assigneeId: 'user-3',
    projectId: 'project-1',
    createdAt: '2026-03-01T08:00:00.000Z',
  },
  {
    id: 'issue-2',
    title: 'Set up end-to-end tests for checkout flow',
    description:
      'Write Playwright tests covering the full checkout flow including address selection, payment, and confirmation screen.',
    status: 'todo',
    priority: 'medium',
    storyPoints: 8,
    assigneeId: 'user-4',
    projectId: 'project-1',
    createdAt: '2026-03-03T09:15:00.000Z',
  },
  {
    id: 'issue-3',
    title: 'Migrate admin panel to new design system',
    description:
      'Replace legacy Bootstrap components in the admin panel with tokens and components from the 3SC design system.',
    status: 'todo',
    priority: 'low',
    storyPoints: 8,
    assigneeId: null,
    projectId: 'project-2',
    createdAt: '2026-03-05T10:00:00.000Z',
  },

  // --- in_progress (4) ---
  {
    id: 'issue-4',
    title: 'Fix login timeout on mobile browsers',
    description:
      'Users on iOS Safari are being logged out after 5 minutes regardless of activity. Investigate session cookie handling and refresh token logic.',
    status: 'in_progress',
    priority: 'critical',
    storyPoints: 3,
    assigneeId: 'user-3',
    projectId: 'project-1',
    createdAt: '2026-02-20T14:00:00.000Z',
  },
  {
    id: 'issue-5',
    title: 'Add role-based access control to API routes',
    description:
      'Enforce RBAC middleware on all sensitive API endpoints. Admin and PM roles should have write access; viewers should be read-only.',
    status: 'in_progress',
    priority: 'high',
    storyPoints: 5,
    assigneeId: 'user-4',
    projectId: 'project-1',
    createdAt: '2026-02-22T11:00:00.000Z',
  },
  {
    id: 'issue-6',
    title: 'Build shipment tracking widget',
    description:
      'Create a dashboard widget that pulls live shipment status from the logistics API and displays it with a progress stepper.',
    status: 'in_progress',
    priority: 'high',
    storyPoints: 5,
    assigneeId: 'user-3',
    projectId: 'project-1',
    createdAt: '2026-02-25T09:00:00.000Z',
  },
  {
    id: 'issue-7',
    title: 'Automate weekly ops report generation',
    description:
      'Write a cron job that queries the warehouse DB every Monday at 6 AM and emails a PDF summary to the operations lead.',
    status: 'in_progress',
    priority: 'medium',
    storyPoints: 3,
    assigneeId: 'user-4',
    projectId: 'project-2',
    createdAt: '2026-03-10T08:30:00.000Z',
  },

  // --- done (3) ---
  {
    id: 'issue-8',
    title: 'Integrate Google SSO on login page',
    description:
      'Allow users to sign in with their 3SC Google Workspace account using OAuth 2.0. Map Google profile to existing user records by email.',
    status: 'done',
    priority: 'high',
    storyPoints: 5,
    assigneeId: 'user-3',
    projectId: 'project-1',
    createdAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'issue-9',
    title: 'Fix broken pagination on issues list',
    description:
      'Page 2 onwards of the issues list returns a 500 error due to an off-by-one error in the offset calculation on the backend.',
    status: 'done',
    priority: 'critical',
    storyPoints: 1,
    assigneeId: 'user-4',
    projectId: 'project-2',
    createdAt: '2026-01-20T13:00:00.000Z',
  },
  {
    id: 'issue-10',
    title: 'Add dark mode support to client portal',
    description:
      'Implement a dark/light mode toggle using CSS variables. Persist the user preference in localStorage.',
    status: 'done',
    priority: 'low',
    storyPoints: 3,
    assigneeId: 'user-3',
    projectId: 'project-1',
    createdAt: '2026-02-01T09:00:00.000Z',
  },
];
