export type Role = 'admin' | 'pm' | 'developer' | 'viewer';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type IssueStatus = 'todo' | 'in_progress' | 'review' | 'blocked' | 'done';

export type IssueType = 'feat' | 'bug' | 'chore' | 'design';

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
  memberIds: string[];   // workspace user-ids assigned to this project
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
  // Kanban display fields
  due?:          string | null;
  issueType?:    IssueType;
  progress?:     number;
  subtaskCount?: number;
}

export interface WikiContributor {
  initials: string;
  name: string;
  role: string;
  colorClass: string; // CSS class e.g. 'ds-av-pk'
}

export interface WikiVersion {
  label: string;
  ago: string;
  isLatest?: boolean;
}

export interface WikiLinkedIssue {
  id: string;
  title: string;
  type: 'bug' | 'story' | 'task';
}

export interface TocItem {
  level: number; // 2 or 3
  text: string;
  id: string;
}

/** A documentation page within a project, supporting nested hierarchy. */
export interface WikiPage {
  id: string;
  title: string;
  content: string; // HTML string (Tiptap)
  parentId: string | null;
  projectId: string;
  updatedAt: string;
  // Extended optional metadata
  createdAt?: string;
  emoji?: string;
  icon?: string;           // emoji icon shown in the tree
  section?: string;        // grouping: 'Engineering' | 'Design' | 'Product' | 'Onboarding'
  tags?: string[];
  viewCount?: number;
  commentCount?: number;
  contributors?: WikiContributor[];
  versions?: WikiVersion[];
  linkedIssues?: WikiLinkedIssue[];
  relatedPageIds?: string[];
}

/** A member entry returned by GET /projects/:id/members */
export interface ProjectMember {
  id: string;
  user: User;
  joinedAt: string;
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
