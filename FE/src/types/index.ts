export type Role = 'admin' | 'pm' | 'developer' | 'viewer';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type IssueStatus = 'todo' | 'in_progress' | 'review' | 'done';

/** A user account in the system. */
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
}

/** A top-level project container that groups issues and wiki pages. */
export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: string;
}

/** A single trackable unit of work within a project. */
export interface Issue {
  id: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: Priority;
  storyPoints: number;
  assigneeId: string | null;
  projectId: string;
  createdAt: string;
  sprintId?:  string | null;
  labelIds?:  string[];
  updatedAt?: string;
}

/** A documentation page within a project, supporting nested hierarchy. */
export interface WikiPage {
  id: string;
  title: string;
  content: string;
  parentId: string | null;
  projectId: string;
  updatedAt: string;
}

/** A unified search result that can represent either an issue or a wiki page. */
export interface SearchResult {
  id: string;
  type: 'issue' | 'wiki';
  title: string;
  excerpt: string;
  projectId: string;
}

/** Data required to create a new issue (excludes server-generated fields). */
export type CreateIssueDto = Omit<Issue, 'id' | 'createdAt'>;

/** Partial update payload for an existing issue. */
export type UpdateIssueDto = Partial<CreateIssueDto>;
