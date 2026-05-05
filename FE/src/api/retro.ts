import { apiClient } from './client';
import type { SprintRetro, SprintRetroEdit } from '../types';

export const retroApi = {
  /** Generate (or regenerate) a retro by calling the AI. Overwrites any prior saved retro. */
  generate(sprintId: string): Promise<SprintRetro> {
    return apiClient
      .post<SprintRetro>(`/sprints/${sprintId}/retro/generate`, {}, { timeout: 120_000 })
      .then((r) => r.data);
  },

  /** Retrieve the saved retro for a sprint. Throws 404 if none exists. */
  get(sprintId: string): Promise<SprintRetro> {
    return apiClient
      .get<SprintRetro>(`/sprints/${sprintId}/retro`)
      .then((r) => r.data);
  },

  /** Persist user-edited retro content. */
  save(sprintId: string, edits: SprintRetroEdit): Promise<SprintRetro> {
    return apiClient
      .patch<SprintRetro>(`/sprints/${sprintId}/retro`, edits)
      .then((r) => r.data);
  },
};
