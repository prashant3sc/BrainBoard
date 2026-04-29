import { apiClient } from './client';

export interface VelocitySprint {
  sprint_id: string;
  sprint_name: string;
  status: 'active' | 'completed';
  start_date: string | null;
  end_date: string | null;
  committed: number;
  completed: number;
  completion_rate: number;
}

export interface VelocityData {
  project_id: string;
  project_name: string;
  sprints: VelocitySprint[];
  avg_velocity: number;
}

export interface WorkloadMember {
  user_id: string | null;
  name: string;
  email: string;
  role: string;
  todo: number;
  in_progress: number;
  review: number;
  done: number;
  total: number;
  story_points: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface WorkloadData {
  project_id: string;
  project_name: string;
  total_issues: number;
  members: WorkloadMember[];
}

export interface BurndownDay {
  date: string;
  ideal_remaining: number;
  actual_remaining: number;
  completed: number;
}

export interface BurndownSprintMeta {
  sprint_id: string;
  sprint_name: string;
  status: 'active' | 'completed';
  start_date: string | null;
  end_date: string | null;
}

export interface BurndownData {
  sprint_id: string;
  sprint_name: string;
  status: 'active' | 'completed' | 'planned';
  start_date: string | null;
  end_date: string | null;
  total_points: number;
  completed_points: number;
  days: BurndownDay[];
  all_sprints: BurndownSprintMeta[];
}

export interface KBSpace {
  space_id: string | null;
  name: string;
  page_count: number;
  edit_count: number;
}

export interface KBTopPage {
  page_id: string;
  title: string;
  edit_count: number;
  link_count: number;
  updated_at: string;
}

export interface KBContributor {
  user_id: string;
  name: string;
  edit_count: number;
}

export interface KBActivity {
  page_id: string;
  title: string;
  version_number: number;
  user: string;
  date: string;
}

export interface KBAnalyticsData {
  project_id: string;
  total_pages: number;
  total_edits: number;
  total_links: number;
  spaces: KBSpace[];
  top_pages: KBTopPage[];
  top_contributors: KBContributor[];
  recent_activity: KBActivity[];
}

export const analyticsApi = {
  getVelocity: (projectId: string): Promise<VelocityData> =>
    apiClient
      .get(`/projects/${projectId}/analytics/velocity`)
      .then((r: { data: VelocityData }) => r.data),

  getWorkload: (projectId: string): Promise<WorkloadData> =>
    apiClient
      .get(`/projects/${projectId}/analytics/workload`)
      .then((r: { data: WorkloadData }) => r.data),

  getBurndown: (projectId: string, sprintId?: string): Promise<BurndownData> =>
    apiClient
      .get(`/projects/${projectId}/analytics/burndown`, { params: sprintId ? { sprint_id: sprintId } : {} })
      .then((r: { data: BurndownData }) => r.data),

  getKBAnalytics: (projectId: string): Promise<KBAnalyticsData> =>
    apiClient
      .get(`/projects/${projectId}/analytics/kb`)
      .then((r: { data: KBAnalyticsData }) => r.data),
};
