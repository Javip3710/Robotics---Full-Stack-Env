/** React Query hooks wrapping the API functions. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  authApi,
  docsApi,
  eventsApi,
  inventoryApi,
  membersApi,
  newsApi,
  scoutingApi,
} from "./endpoints";

export const qk = {
  me: ["me"] as const,
  news: (includeDrafts: boolean) => ["news", includeDrafts] as const,
  featured: ["news", "featured"] as const,
  docs: (search: string, category: string) => ["docs", search, category] as const,
  docCategories: ["docs", "categories"] as const,
  events: (upcoming: boolean) => ["events", upcoming] as const,
  members: (status: string, role: string) => ["members", status, role] as const,
  templates: (all: boolean) => ["scouting", "templates", all] as const,
  template: (id: number) => ["scouting", "template", id] as const,
  templateVersion: (id: number, version: number) =>
    ["scouting", "templateVersion", id, version] as const,
  submissions: (filters: Record<string, unknown>) => ["scouting", "submissions", filters] as const,
  submission: (id: number) => ["scouting", "submission", id] as const,
  inventoryItems: (filters: Record<string, unknown>) => ["inventory", "items", filters] as const,
  inventoryCategories: ["inventory", "categories"] as const,
  inventoryItem: (id: number) => ["inventory", "item", id] as const,
  itemAdjustments: (id: number) => ["inventory", "adjustments", id] as const,
  allAdjustments: ["inventory", "adjustments"] as const,
};

// --- News -------------------------------------------------------------------

export function useNews(includeDrafts = false) {
  return useQuery({
    queryKey: qk.news(includeDrafts),
    queryFn: () => newsApi.list({ includeDrafts }),
  });
}

export function useFeaturedNews() {
  return useQuery({ queryKey: qk.featured, queryFn: () => newsApi.featured() });
}

export function useNewsMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["news"] });
  };
  return {
    create: useMutation({ mutationFn: newsApi.create, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
        newsApi.update(id, body),
      onSuccess: invalidate,
    }),
  };
}

// --- Documents ----------------------------------------------------------------

export function useDocs(search: string, category: string) {
  return useQuery({ queryKey: qk.docs(search, category), queryFn: () => docsApi.list({ search, category }) });
}

export function useDocCategories() {
  return useQuery({ queryKey: qk.docCategories, queryFn: docsApi.categories });
}

export function useDocMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["docs"] });
  return {
    create: useMutation({ mutationFn: docsApi.create, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ slug, body }: { slug: string; body: Record<string, unknown> }) =>
        docsApi.update(slug, body),
      onSuccess: invalidate,
    }),
  };
}

// --- Events -------------------------------------------------------------------

export function useEvents(upcoming = true) {
  return useQuery({ queryKey: qk.events(upcoming), queryFn: () => eventsApi.list(upcoming) });
}

export function useEventMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["events"] });
  return {
    create: useMutation({ mutationFn: eventsApi.create, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) => eventsApi.update(id, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: eventsApi.remove, onSuccess: invalidate }),
  };
}

// --- Members -------------------------------------------------------------------

export function useMembers(status: string, role: string) {
  return useQuery({
    queryKey: qk.members(status, role),
    queryFn: () => membersApi.list({ status, role }),
  });
}

export function useMemberMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["members"] });
  return {
    setRole: useMutation({
      mutationFn: ({ id, role }: { id: number; role: string }) => membersApi.setRole(id, role),
      onSuccess: invalidate,
    }),
    approve: useMutation({ mutationFn: membersApi.approve, onSuccess: invalidate }),
    suspend: useMutation({ mutationFn: membersApi.suspend, onSuccess: invalidate }),
    remove: useMutation({ mutationFn: membersApi.remove, onSuccess: invalidate }),
  };
}

// --- Scouting -----------------------------------------------------------------

export function useTemplates(allStatuses = false) {
  return useQuery({
    queryKey: qk.templates(allStatuses),
    queryFn: () => scoutingApi.listTemplates(allStatuses),
  });
}

export function useTemplate(id: number) {
  return useQuery({ queryKey: qk.template(id), queryFn: () => scoutingApi.getTemplate(id) });
}

export function useTemplateVersion(templateId: number, version: number) {
  return useQuery({
    queryKey: qk.templateVersion(templateId, version),
    queryFn: () => scoutingApi.templateVersion(templateId, version),
  });
}

export function useTemplateMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["scouting", "templates"] });
    qc.invalidateQueries({ queryKey: ["scouting", "template"] });
  };
  return {
    create: useMutation({ mutationFn: scoutingApi.createTemplate, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
        scoutingApi.updateTemplate(id, body),
      onSuccess: invalidate,
    }),
  };
}

export function useSubmissions(filters: { event?: string; team?: number; match?: string; template?: number }) {
  return useQuery({
    queryKey: qk.submissions(filters as Record<string, unknown>),
    queryFn: () => scoutingApi.listSubmissions(filters),
  });
}

export function useSubmission(id: number) {
  return useQuery({ queryKey: qk.submission(id), queryFn: () => scoutingApi.getSubmission(id) });
}

// --- Inventory -----------------------------------------------------------------

export function useInventoryItems(filters: {
  search?: string;
  category?: string;
  location?: string;
  includeArchived?: boolean;
}) {
  return useQuery({
    queryKey: qk.inventoryItems(filters as Record<string, unknown>),
    queryFn: () => inventoryApi.listItems(filters),
  });
}

export function useInventoryCategories() {
  return useQuery({ queryKey: qk.inventoryCategories, queryFn: inventoryApi.categories });
}

export function useInventoryItem(id: number) {
  return useQuery({ queryKey: qk.inventoryItem(id), queryFn: () => inventoryApi.getItem(id) });
}

export function useItemAdjustments(id: number) {
  return useQuery({ queryKey: qk.itemAdjustments(id), queryFn: () => inventoryApi.itemAdjustments(id) });
}

export function useInventoryMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["inventory"] });
  };
  return {
    create: useMutation({ mutationFn: inventoryApi.createItem, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
        inventoryApi.updateItem(id, body),
      onSuccess: invalidate,
    }),
    adjust: useMutation({
      mutationFn: ({ id, ...body }: { id: number; quantity_change: number; reason: string }) =>
        inventoryApi.adjust(id, body),
      onSuccess: invalidate,
    }),
  };
}
