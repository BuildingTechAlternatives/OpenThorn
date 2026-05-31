declare module '@babel/standalone' {
  export interface BabelTransformOptions {
    presets?: string[]
    filename?: string
    sourceMaps?: boolean
    plugins?: string[]
    [key: string]: unknown
  }

  export interface BabelTransformResult {
    code: string | null
    map?: unknown
    ast?: unknown
  }

  export function transform(
    code: string,
    options: BabelTransformOptions
  ): BabelTransformResult

  export function registerPlugin(name: string, plugin: unknown): void
  export function registerPreset(name: string, preset: unknown): void
}
