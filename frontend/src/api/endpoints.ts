/** Per-resource API functions. Server-state hooks live in src/api/hooks.ts. */

import { api } from "./client";
import type {
  Adjustment,
  CurrentUser,
  Doc,
  InventoryItem,
  Member,
  NewsPost,
  Paginated,
  Submission,
  TeamEvent,
  Template,
  TemplateVersion,
} from "./types";

// --- Auth -------------------------------------------------------------------

export const authApi = {
  register: (body: { name: string; email: string; password: string }) =>
    api.post<CurrentUser>("/auth/register", body),
  login: (body: { email: string; password: string }) =>
    api.post<{ token: string; user: CurrentUser }>("/auth/login", body),
  me: () => api.get<{ user: CurrentUser | null }>("/auth/me"),
};

// --- News -------------------------------------------------------------------

export const newsApi = {
  list: (params: { includeDrafts?: boolean; perPage?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.includeDrafts) q.set("include_drafts", "1");
    q.set("per_page", String(params.perPage ?? 10));
    return api.get<Paginated<NewsPost>>(`/news?${q}`);
  },
  featured: () => api.get<{ post: NewsPost | null }>("/news/featured"),
  get: (id: number) => api.get<{ post: NewsPost }>(`/news/${id}`),
  create: (body: Partial<NewsPost> & { published?: boolean; featured?: boolean }) =>
    api.post<{ post: NewsPost }>("/news", body),
  update: (id: number, body: Record<string, unknown>) =>
    api.patch<{ post: NewsPost }>(`/news/${id}`, body),
};

// --- Documents ----------------------------------------------------------------

export const docsApi = {
  list: (params: { search?: string; category?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.category) q.set("category", params.category);
    return api.get<{ items: Doc[]; total: number }>(`/documents?${q}`);
  },
  categories: () => api.get<{ items: string[] }>("/documents/categories"),
  get: (slug: string) => api.get<Doc>(`/documents/${slug}`),
  create: (body: Record<string, unknown>) => api.post<Doc>("/documents", body),
  update: (slug: string, body: Record<string, unknown>) => api.patch<Doc>(`/documents/${slug}`, body),
};

// --- Events -------------------------------------------------------------------

export const eventsApi = {
  list: (upcomingOnly = true) => api.get<{ items: TeamEvent[] }>(`/events${upcomingOnly ? "?upcoming=1" : ""}`),
  create: (body: Record<string, unknown>) => api.post<TeamEvent>("/events", body),
  update: (id: number, body: Record<string, unknown>) => api.patch<TeamEvent>(`/events/${id}`, body),
  remove: (id: number) => api.delete<{ ok: boolean }>(`/events/${id}`),
};

// --- Members -------------------------------------------------------------------

export const membersApi = {
  list: (params: { status?: string; role?: string; page?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.role) q.set("role", params.role);
    q.set("per_page", "100");
    return api.get<Paginated<Member>>(`/members?${q}`);
  },
  get: (id: number) => api.get<Member>(`/members/${id}`),
  setRole: (id: number, role: string) => api.patch<Member>(`/members/${id}`, { role }),
  approve: (id: number) => api.post<Member>(`/members/${id}/approve`),
  suspend: (id: number) => api.post<Member>(`/members/${id}/suspend`),
  remove: (id: number) => api.delete<{ ok: boolean }>(`/members/${id}`),
};

// --- Uploads (news images) ---------------------------------------------------

export const uploadsApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.upload<{ url: string; filename: string }>("/uploads", form);
  },
};

// --- Scouting -----------------------------------------------------------------

export const scoutingApi = {
  listTemplates: (allStatuses = false) =>
    api.get<{ items: Template[]; total: number }>(`/scouting/templates${allStatuses ? "" : "?status=active"}`),
  getTemplate: (id: number) => api.get<Template>(`/scouting/templates/${id}`),
  createTemplate: (body: Record<string, unknown>) => api.post<Template>("/scouting/templates", body),
  updateTemplate: (id: number, body: Record<string, unknown>) =>
    api.patch<Template>(`/scouting/templates/${id}`, body),
  templateVersion: (templateId: number, version: number) =>
    api.get<TemplateVersion>(`/scouting/templates/${templateId}/versions/${version}`),
  listSubmissions: (params: {
    event?: string;
    team?: number;
    match?: string;
    template?: number;
    page?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.event) q.set("event", params.event);
    if (params.team) q.set("team", String(params.team));
    if (params.match) q.set("match", params.match);
    if (params.template) q.set("template", String(params.template));
    q.set("per_page", "50");
    return api.get<Paginated<Submission>>(`/scouting/submissions?${q}`);
  },
  getSubmission: (id: number) => api.get<Submission>(`/scouting/submissions/${id}`),
  createSubmission: (body: {
    event_name: string;
    team_number: number;
    match_key?: string | null;
    template_id: number;
    answers: Record<string, unknown>;
  }) => api.post<Submission>("/scouting/submissions", body),
  updateSubmission: (id: number, body: Record<string, unknown>) =>
    api.patch<Submission>(`/scouting/submissions/${id}`, body),
  deleteSubmission: (id: number) => api.delete<{ ok: boolean }>(`/scouting/submissions/${id}`),
};

// --- Inventory -----------------------------------------------------------------

export const inventoryApi = {
  listItems: (params: { search?: string; category?: string; location?: string; includeArchived?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.category) q.set("category", params.category);
    if (params.location) q.set("location", params.location);
    if (params.includeArchived) q.set("include_archived", "1");
    return api.get<{ items: InventoryItem[]; total: number }>(`/inventory/items?${q}`);
  },
  categories: () => api.get<{ items: string[] }>("/inventory/categories"),
  getItem: (id: number) => api.get<InventoryItem>(`/inventory/items/${id}`),
  createItem: (body: Record<string, unknown>) => api.post<InventoryItem>("/inventory/items", body),
  updateItem: (id: number, body: Record<string, unknown>) =>
    api.patch<InventoryItem>(`/inventory/items/${id}`, body),
  adjust: (id: number, body: { quantity_change: number; reason: string }) =>
    api.post<{ item: InventoryItem; adjustment_created: boolean }>(`/inventory/items/${id}/adjust`, body),
  itemAdjustments: (id: number) =>
    api.get<{ items: Adjustment[]; total: number }>(`/inventory/items/${id}/adjustments`),
  allAdjustments: () => api.get<Paginated<Adjustment>>("/inventory/adjustments"),
};
