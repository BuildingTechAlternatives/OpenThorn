import * as esbuild from 'esbuild-wasm'

let initPromise: Promise<void> | null = null

/**
 * Initialize esbuild-wasm exactly once.
 * Safe to call multiple times — returns the cached promise after the first call.
 */
export function initCompiler(): Promise<void> {
  if (!initPromise) {
    initPromise = esbuild.initialize({
      worker: false,
      wasmURL: 'https://unpkg.com/esbuild-wasm@0.28.0/esbuild.wasm',
    })
  }
  return initPromise
}
