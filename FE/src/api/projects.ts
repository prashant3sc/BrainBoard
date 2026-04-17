import { apiClient } from './client';
import type { Project } from '../types';
import { mockProjects } from '../mocks/projects';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

type CreateProjectDto = Omit<Project, 'id' | 'createdAt'>;
type UpdateProjectDto = Partial<CreateProjectDto>;

export const projectsApi = {
  // Fetch all projects visible to the current user
  getAll(): Promise<Project[]> {
    if (USE_MOCK) return Promise.resolve([...mockProjects]);
    return apiClient.get<Project[]>('/projects').then((r) => r.data);
  },

  // Fetch a single project by its id
  getById(id: string): Promise<Project> {
    if (USE_MOCK) {
      const found = mockProjects.find((p) => p.id === id);
      if (!found) return Promise.reject(new Error(`Project ${id} not found`));
      return Promise.resolve({ ...found });
    }
    return apiClient.get<Project>(`/projects/${id}`).then((r) => r.data);
  },

  // Create a new project and return the persisted record
  create(dto: CreateProjectDto): Promise<Project> {
    if (USE_MOCK) {
      const data: Project = {
        ...dto,
        id: `project-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      mockProjects.push(data);
      return Promise.resolve({ ...data });
    }
    return apiClient.post<Project>('/projects/create', dto).then((r) => r.data);
  },

  // Apply a partial update to an existing project
  update(id: string, dto: UpdateProjectDto): Promise<Project> {
    if (USE_MOCK) {
      const index = mockProjects.findIndex((p) => p.id === id);
      if (index === -1) return Promise.reject(new Error(`Project ${id} not found`));
      mockProjects[index] = { ...mockProjects[index], ...dto };
      return Promise.resolve({ ...mockProjects[index] });
    }
    return apiClient.patch<Project>(`/projects/${id}`, dto).then((r) => r.data);
  },

  // Add a workspace user to a project's member list
  addMember(projectId: string, userId: string): Promise<Project> {
    if (USE_MOCK) {
      const index = mockProjects.findIndex((p) => p.id === projectId);
      if (index === -1) return Promise.reject(new Error(`Project ${projectId} not found`));
      if (!mockProjects[index].memberIds.includes(userId)) {
        mockProjects[index] = {
          ...mockProjects[index],
          memberIds: [...mockProjects[index].memberIds, userId],
        };
      }
      return Promise.resolve({ ...mockProjects[index] });
    }
    return apiClient.post<Project>(`/projects/${projectId}/members`, { userId }).then((r) => r.data);
  },

  // Remove a user from a project's member list
  removeMember(projectId: string, userId: string): Promise<Project> {
    if (USE_MOCK) {
      const index = mockProjects.findIndex((p) => p.id === projectId);
      if (index === -1) return Promise.reject(new Error(`Project ${projectId} not found`));
      mockProjects[index] = {
        ...mockProjects[index],
        memberIds: mockProjects[index].memberIds.filter((id) => id !== userId),
      };
      return Promise.resolve({ ...mockProjects[index] });
    }
    return apiClient.delete<Project>(`/projects/${projectId}/members/${userId}`).then((r) => r.data);
  },

  // Delete a project by id
  remove(id: string): Promise<void> {
    if (USE_MOCK) {
      const index = mockProjects.findIndex((p) => p.id === id);
      if (index !== -1) mockProjects.splice(index, 1);
      return Promise.resolve();
    }
    return apiClient.delete(`/projects/${id}`).then(() => undefined);
  },
};
