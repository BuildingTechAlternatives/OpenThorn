// OpenThorn dev jsx-runtime shim. Injected into instrumented previews via a
// data: URL so clicking a rendered element can be traced to its JSX source.
// Mirrors injectOeidProps in src/lib/preview-edit.ts — keep in sync.
import { jsxDEV as _jsxDEV, Fragment } from 'https://esm.sh/react@18.2.0/jsx-dev-runtime'

function oeid(source) {
  if (!source || !source.fileName) return ''
  var file = String(source.fileName).replace(/^virtual:/, '').replace(/^\/+/, '')
  file = file.split('/').pop()
  return file + ':' + source.lineNumber + ':' + source.columnNumber
}

export function jsxDEV(type, props, key, isStaticChildren, source, self) {
  if (typeof type === 'string' && source) {
    var next = Object.assign({}, props)
    next['data-oeid'] = oeid(source)
    return _jsxDEV(type, next, key, isStaticChildren, source, self)
  }
  return _jsxDEV(type, props, key, isStaticChildren, source, self)
}

export { Fragment }
