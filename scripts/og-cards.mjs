// Renders 1200x630 Open Graph cards at build time with satori (JSX-object →
// SVG) and resvg (SVG → PNG). Colors mirror the design tokens in src/index.css
// (--color-bg #09070B, --color-text #F4EFF8, --color-accent #A78BFA).
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { readFileSync } from 'fs'
import { join } from 'path'

export function loadFonts(rootDir) {
  return [
    {
      name: 'Fraunces',
      data: readFileSync(join(rootDir, 'node_modules', '@fontsource', 'fraunces', 'files', 'fraunces-latin-600-normal.woff')),
      weight: 600,
      style: 'normal',
    },
    {
      name: 'Roboto',
      data: readFileSync(join(rootDir, 'node_modules', '@fontsource', 'roboto', 'files', 'roboto-latin-400-normal.woff')),
      weight: 400,
      style: 'normal',
    },
  ]
}

export async function renderOgCard({ title, eyebrow }, fonts) {
  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          backgroundColor: '#09070B',
          backgroundImage: 'radial-gradient(circle at 85% 15%, rgba(167,139,250,0.25), transparent 55%)',
          color: '#F4EFF8',
          fontFamily: 'Roboto',
        },
        children: [
          {
            type: 'div',
            props: {
              style: { fontSize: 30, letterSpacing: 4, textTransform: 'uppercase', color: '#A78BFA', display: 'flex' },
              children: eyebrow,
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: title.length > 55 ? 56 : 72,
                fontFamily: 'Fraunces',
                fontWeight: 600,
                lineHeight: 1.15,
                display: 'flex',
                maxWidth: 1000,
              },
              children: title,
            },
          },
          {
            type: 'div',
            props: {
              style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 32 },
              children: [
                { type: 'div', props: { style: { fontFamily: 'Fraunces', fontWeight: 600, display: 'flex' }, children: 'OpenThorn' } },
                { type: 'div', props: { style: { color: '#A78BFA', display: 'flex' }, children: 'openthorn.app' } },
              ],
            },
          },
        ],
      },
    },
    { width: 1200, height: 630, fonts }
  )

  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng()
}
