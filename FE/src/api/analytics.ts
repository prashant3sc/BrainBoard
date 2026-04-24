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

export const analyticsApi = {
  getVelocity: (projectId: string): Promise<VelocityData> =>
    apiClient
      .get(`/projects/${projectId}/analytics/velocity`)
      .then((r: { data: VelocityData }) => r.data),
};
