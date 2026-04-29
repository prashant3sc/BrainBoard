import type { Comment } from '@/types';
import { apiClient } from './client';

export const commentsApi = {
  /** GET /issues/:issueId/comments — all top-level comments with nested replies */
  list(issueId: string): Promise<Comment[]> {
    return apiClient.get(`/issues/${issueId}/comments`).then((r) => r.data);
  },

  /** POST /issues/:issueId/comments — create a comment or reply */
  create(issueId: string, body: string, parentId?: string): Promise<Comment> {
    return apiClient
      .post(`/issues/${issueId}/comments`, { body, parentId: parentId ?? null })
      .then((r) => r.data);
  },

  /** PATCH /comments/:id — edit own comment body */
  edit(commentId: string, body: string): Promise<Comment> {
    return apiClient.patch(`/comments/${commentId}`, { body }).then((r) => r.data);
  },

  /** DELETE /comments/:id — admin/PM only */
  remove(commentId: string): Promise<void> {
    return apiClient.delete(`/comments/${commentId}`).then(() => undefined);
  },
};
