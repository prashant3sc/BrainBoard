import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wikiApi } from '@/api/wiki';
import type { WikiPage, WikiPageVersion } from '@/types';

type CreateWikiPageDto = Omit<WikiPage, 'id' | 'updatedAt'>;
type UpdateWikiPageDto = Partial<CreateWikiPageDto>;

export function useWikiPages(projectId: string) {
  return useQuery({
    queryKey: ['wiki', projectId],
    queryFn: () => wikiApi.getAll(projectId),
  });
}

export function useCreateWikiPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateWikiPageDto) => wikiApi.create(dto),
    onSuccess: (_data, dto) => {
      qc.invalidateQueries({ queryKey: ['wiki', dto.projectId] });
      // TODO: toast({ title: 'Page created' })
    },
  });
}

export function useUpdateWikiPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateWikiPageDto; projectId: string }) =>
      wikiApi.update(id, dto),
    onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: ['wiki', projectId] }),
  });
}

export function useDeleteWikiPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) => wikiApi.remove(id),
    onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: ['wiki', projectId] }),
  });
}

export function useWikiHistory(pageId: string | null) {
  return useQuery<WikiPageVersion[]>({
    queryKey: ['wiki-history', pageId],
    queryFn: () => wikiApi.getHistory(pageId!),
    enabled: !!pageId,
  });
}

export function useLinkTicket() {
  return useMutation({
    mutationFn: ({ pageId, issueId }: { pageId: string; issueId: string }) =>
      wikiApi.linkTicket(pageId, issueId),
  });
}

export function useUnlinkTicket() {
  return useMutation({
    mutationFn: ({ pageId, issueId }: { pageId: string; issueId: string }) =>
      wikiApi.unlinkTicket(pageId, issueId),
  });
}
