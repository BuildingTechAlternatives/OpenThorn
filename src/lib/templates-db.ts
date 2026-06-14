import { supabase } from './supabase'
import type { Template } from './templates'
import type { AgentCodeFile } from './agent'

interface TemplateRow {
  id: string
  template_key: string
  name: string
  description: string
  category: string
  accent_color: string
  highlights: string[] | null
  files: AgentCodeFile[] | null
}

function rowToTemplate(r: TemplateRow): Template {
  return {
    id: r.template_key || r.id,
    name: r.name,
    description: r.description,
    category: r.category as Template['category'],
    accentColor: r.accent_color,
    highlights: Array.isArray(r.highlights) ? r.highlights : [],
    files: Array.isArray(r.files) ? r.files : [],
  }
}

/** Published templates ordered for display. Null on error → caller keeps bundled. */
export async function fetchPublishedTemplates(): Promise<Template[] | null> {
  const { data, error } = await supabase
    .from('templates')
    .select('id,template_key,name,description,category,accent_color,highlights,files')
    .eq('status', 'published')
    .order('featured', { ascending: false })
    .order('sort_order', { ascending: true })
  if (error || !data) return null
  return (data as TemplateRow[]).map(rowToTemplate).filter((t) => t.files.length > 0)
}
