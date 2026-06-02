import { supabase } from './supabase'

export interface CodeFile {
  path: string
  language: string
  code: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function bundleProject(files: CodeFile[], title: string): string {
  let css = ''
  let components = ''

  for (const file of files) {
    if (file.language === 'css') {
      css += `/* ${file.path} */\n${file.code}\n`
    } else if (file.language === 'tsx' || file.language === 'jsx') {
      // Strip import/export — Babel standalone runs everything in one scope
      const cleaned = file.code
        .replace(/^\s*import\s+.*$/gm, '')
        .replace(/^\s*export\s+default\s+/gm, 'const Default_')
        .replace(/^\s*export\s+/gm, '')
      components += `// ${file.path}\n${cleaned}\n`
    } else {
      components += `// ${file.path}\n${file.code}\n`
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
</head>
<body>
  <div id="root"></div>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js" crossorigin="anonymous"></script>
  <script type="text/babel">
const { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext } = React;
${components}

// Find and render the root component
var rootComponent = typeof App !== 'undefined' ? App
  : typeof Default_ !== 'undefined' ? Default_
  : null;

if (rootComponent) {
  var root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(rootComponent));
}
  </script>
</body>
</html>`
}

export async function deployToStorage(projectId: string, html: string): Promise<string> {
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' })

  const { error } = await supabase.storage
    .from('deployments')
    .upload(`${projectId}/index.html`, blob, {
      contentType: 'text/html',
      upsert: true,
      cacheControl: '3600',
    })

  if (error) {
    throw new Error(`Deploy failed: ${error.message}`)
  }

  const { data } = supabase.storage
    .from('deployments')
    .getPublicUrl(`${projectId}/index.html`)

  return data.publicUrl
}
