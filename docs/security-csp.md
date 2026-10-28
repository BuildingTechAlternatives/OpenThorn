# Content Security Policy Notes

`vercel.json` removes script-level `unsafe-inline` and `unsafe-eval`; the app keeps
`wasm-unsafe-eval` because the builder relies on browser-side WebAssembly tooling.

`style-src 'unsafe-inline'` is intentionally retained for launch because the React UI
uses dynamic inline styles for component state, chart positioning, and CSS variable
values. Removing it should be tracked as a separate hardening project after those
inline styles are moved into class-based CSS.
