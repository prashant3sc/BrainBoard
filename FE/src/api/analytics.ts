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

export const analyticsApi = {
  getVelocity: (projectId: string): Promise<VelocityData> =>
    apiClient
      .get(`/projects/${projectId}/analytics/velocity`)
      .then((r: { data: VelocityData }) => r.data),

  getWorkload: (projectId: string): Promise<WorkloadData> =>
    apiClient
      .get(`/projects/${projectId}/analytics/workload`)
      .then((r: { data: WorkloadData }) => r.data),
};
