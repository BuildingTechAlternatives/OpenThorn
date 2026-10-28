import { supabase } from './supabase'
import type { AgentCodeFile } from './agent'

export interface AdminTemplateRow {
  id: string
  template_key: string
  name: string
  description: string
  category: string
  accent_color: string
  highlights: string[]
  files: AgentCodeFile[]
  featured: boolean
  sort_order: number
  status: 'draft' | 'published'
  updated_at: string
}

export type TemplateDraft = Pick<
  AdminTemplateRow,
  'template_key' | 'name' | 'description' | 'category' | 'accent_color'
  | 'highlights' | 'files' | 'featured' | 'sort_order' | 'status'
>

export async function adminListTemplates(): Promise<AdminTemplateRow[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('id,template_key,name,description,category,accent_color,highlights,files,featured,sort_order,status,updated_at')
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as AdminTemplateRow[]
}

export async function adminSaveTemplate(draft: TemplateDraft, id?: string): Promise<void> {
  const row = { ...draft, updated_at: new Date().toISOString() }
  const query = id
    ? supabase.from('templates').update(row).eq('id', id)
    : supabase.from('templates').insert(row)
  const { error } = await query
  if (error) throw new Error(error.message)
}

export async function adminDeleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('templates').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
