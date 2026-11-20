export type Role = "mentor" | "captain" | "lead" | "member";
export type MemberStatus = "pending" | "approved" | "suspended";

export interface CurrentUser {
  id: number;
  name: string;
  email?: string;
  role: Role;
  status: MemberStatus;
  created_at: string;
  updated_at: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  per_page: number;
  total: number;
}

export interface NewsPost {
  id: number;
  title: string;
  summary: string;
  body: string;
  author: string;
  author_id: number;
  published: boolean;
  published_at: string | null;
  featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface Doc {
  id: number;
  slug: string;
  title: string;
  category: string;
  body: string;
  visibility: "public" | "internal";
  created_at: string;
  updated_at: string;
}

export interface TeamEvent {
  id: number;
  name: string;
  date: string;
  location: string;
  description: string;
}

export interface Member {
  id: number;
  name: string;
  email?: string;
  role: Role;
  status: MemberStatus;
  created_at: string;
  updated_at: string;
}

export type FieldType =
  | "short_text"
  | "long_text"
  | "number"
  | "checkbox"
  | "single_select"
  | "multi_select";

export type TemplateStatus = "draft" | "active" | "archived";

export interface FieldDef {
  field_key: string;
  label: string;
  field_type: FieldType;
  required: boolean;
  help_text: string;
  options: string[];
  min_value: number | null;
  max_value: number | null;
  position: number;
}

export interface Template {
  id: number;
  name: string;
  description: string;
  season: string;
  status: TemplateStatus;
  version: number;
  fields?: FieldDef[];
  created_at: string;
  updated_at: string;
}

export interface TemplateVersion {
  template_id: number;
  version: number;
  fields: FieldDef[];
  created_at: string | null;
}

export interface Submission {
  id: number;
  event_name: string;
  team_number: number;
  match_key: string | null;
  template_id: number;
  template_name: string | null;
  template_version: number;
  author: string;
  author_id: number;
  answers?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  location: string;
  part_number: string | null;
  notes: string;
  low_stock_threshold: number | null;
  archived: boolean;
  low_stock: boolean;
  created_at: string;
  updated_at: string;
}

export interface Adjustment {
  id: number;
  item_id: number;
  item_name: string | null;
  quantity_change: number;
  reason: string;
  user: string;
  created_at: string;
}
