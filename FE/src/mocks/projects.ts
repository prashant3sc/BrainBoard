import type { Project } from '../types';

export const mockProjects: Project[] = [
  {
    id: 'project-1',
    name: 'Client Portal v2',
    description:
      'A redesigned self-service portal for clients to track orders, raise requests, and view analytics dashboards in real time.',
    ownerId: 'user-1',
    createdAt: '2026-01-10T09:00:00.000Z',
  },
  {
    id: 'project-2',
    name: 'Internal Tools',
    description:
      'Suite of internal utilities for the operations and engineering teams, including reporting scripts, admin panels, and automation workflows.',
    ownerId: 'user-1',
    createdAt: '2026-02-03T11:30:00.000Z',
  },
];
