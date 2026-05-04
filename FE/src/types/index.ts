export type Role = 'admin' | 'pm' | 'developer' | 'viewer';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type IssueStatus = 'todo' | 'in_progress' | 'review' | 'done';

export type IssueType = 'task' | 'subtask' | 'bug';

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
  key: string;           // short uppercase prefix e.g. "BB", "SHOP"
  ownerId: string;
  memberIds: string[];   // workspace user-ids assigned to this project
  createdAt: string;
  isArchived: boolean;
}

/** A single trackable unit of work within a project. */
export interface Issue {
  id: string;
  ticketId?: string | null;    // e.g. "BB-12"
  sequenceNumber?: number | null;
  title: string;
  description: string;
  status: IssueStatus;
  priority: Priority;
  storyPoints: number;
  assigneeId:  string | null;
  reporterId?: string | null;
  projectId: string;
  createdAt: string;
  sprintId?:  string | null;
  parentId?:  string | null;
  labelIds?:  string[];
  updatedAt?: string;
  // Kanban display fields
  due?:          string | null;
  issueType?:    IssueType;
  progress?:     number;
  subtaskCount?: number;
  commentCount?: number;
  wikiLinked?:   boolean;
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

/** Version history entry from GET /wiki/:id/history */
export interface WikiPageVersion {
  id: string;
  version_number: number;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
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

/** A sprint within a project. */
export type SprintStatus = 'planned' | 'active' | 'completed';

export interface Sprint {
  id: string;
  name: string;
  goal: string;
  status: SprintStatus;
  startDate: string | null;
  endDate: string | null;
  project: string;
  createdAt: string;
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

// ─── Comments ────────────────────────────────────────────────────────────────

export interface CommentAuthor {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatar: string;   // first letter fallback
}

export interface CommentReply {
  id: string;
  parentId: string;
  author: CommentAuthor;
  body: string;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  author: CommentAuthor;
  body: string;
  isEdited: boolean;
  replies: CommentReply[];
  createdAt: string;
  updatedAt: string;
}
