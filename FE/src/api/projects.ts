import { apiClient } from './client';
import type { Project } from '../types';
import { mockProjects } from '../mocks/projects';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

type CreateProjectDto = Omit<Project, 'id' | 'createdAt'>;
type UpdateProjectDto = Partial<CreateProjectDto>;

export const projectsApi = {
  // Fetch all projects visible to the current user
  getAll(): Promise<Project[]> {
    if (USE_MOCK) return Promise.resolve(mockProjects);
    return apiClient.get<Project[]>('/projects').then((r) => r.data);
  },

  // Fetch a single project by its id
  getById(id: string): Promise<Project> {
    if (USE_MOCK) {
      const found = mockProjects.find((p) => p.id === id);
      if (!found) return Promise.reject(new Error(`Project ${id} not found`));
      return Promise.resolve(found);
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
      return Promise.resolve(data);
    }
    return apiClient.post<Project>('/projects', dto).then((r) => r.data);
  },

  // Apply a partial update to an existing project
  update(id: string, dto: UpdateProjectDto): Promise<Project> {
    if (USE_MOCK) {
      const found = mockProjects.find((p) => p.id === id);
      if (!found) return Promise.reject(new Error(`Project ${id} not found`));
      const data: Project = { ...found, ...dto };
      return Promise.resolve(data);
    }
    return apiClient.patch<Project>(`/projects/${id}`, dto).then((r) => r.data);
  },

  // Delete a project by id
  remove(id: string): Promise<void> {
    if (USE_MOCK) return Promise.resolve();
    return apiClient.delete(`/projects/${id}`).then(() => undefined);
  },
};
