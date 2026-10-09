import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

// Run for every build, including Render's Docker build. Generated PNGs are not
// committed: the two SVG files remain the design source of truth.
const publicDir = new URL('../public/', import.meta.url)
for (const [source, output, size] of [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512],
]) {
  const svg = await readFile(new URL(source, publicDir), 'utf8')
  const image = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render()
  if (image.width !== size || image.height !== size) {
    throw new Error(`Expected ${size}x${size} for ${source}`)
  }
  await writeFile(new URL(output, publicDir), image.asPng())
  console.log(`Generated ${fileURLToPath(new URL(output, publicDir))} (${size}x${size})`)
}
