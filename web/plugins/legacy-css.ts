import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { transform } from 'lightningcss'

/** Placeholder in index.html, replaced at build time with the legacy stylesheet URL. */
const LEGACY_HREF_PLACEHOLDER = '__LEGACY_CSS_HREF__'

/**
 * Lowering targets for the legacy stylesheet only. Used for browsers that
 * cannot read `color-mix()` (Chrome/Android WebView before 111). Encoding: major << 16.
 */
const LEGACY_CSS_TARGETS = {
  chrome: 60 << 16,
  android: 60 << 16,
  firefox: 60 << 16,
  safari: 12 << 16,
  ios_saf: 12 << 16,
}

/**
 * Removes cascade-layer wrappers (`@layer x { ... }`) and layer ordering
 * statements (`@layer a, b;`) while keeping every rule in its source order.
 * Browsers without cascade layers drop the whole block, which is why the
 * modern stylesheet renders unstyled there.
 */
export function flattenCascadeLayers(css: string): string {
  let out = css.replace(/@layer\s+[^{};]+;/g, '')
  const opener = /@layer(?:\s+[\w-]+)?\s*\{/
  let match: RegExpExecArray | null
  while ((match = opener.exec(out))) {
    const braceStart = match.index + match[0].length - 1
    let depth = 0
    let end = -1
    for (let i = braceStart; i < out.length; i++) {
      if (out[i] === '{') depth++
      else if (out[i] === '}') {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    if (end < 0) throw new Error('legacy css: unbalanced @layer block')
    out = out.slice(0, match.index) + out.slice(braceStart + 1, end) + out.slice(end + 1)
  }
  return out
}

/**
 * Writes a flattened copy of the main stylesheet for old browsers. Runs in
 * closeBundle, after Vite has written every file, so the main stylesheet is
 * on disk. It finds that stylesheet from the built index.html, then patches
 * the placeholder with the legacy file. The modern stylesheet is not touched.
 */
function legacyCssPlugin(): Plugin {
  let outDir = 'dist'
  return {
    name: 'k-tech-legacy-css',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const htmlPath = path.join(outDir, 'index.html')
      const htmlSource = readFileSync(htmlPath, 'utf8')
      if (!htmlSource.includes(LEGACY_HREF_PLACEHOLDER)) {
        throw new Error('legacy css: placeholder missing from index.html')
      }
      const mainHref = htmlSource.match(/href="\/(assets\/index-[^"]+\.css)"/)?.[1]
      if (!mainHref) throw new Error('legacy css: main stylesheet link not found in index.html')
      const mainSource = readFileSync(path.join(outDir, mainHref), 'utf8')

      const { code } = transform({
        filename: 'legacy.css',
        code: Buffer.from(flattenCascadeLayers(mainSource)),
        minify: true,
        targets: LEGACY_CSS_TARGETS,
      })
      const legacyCss = code.toString()
      const hash = createHash('sha256').update(legacyCss).digest('hex').slice(0, 8)
      const fileName = `assets/legacy-${hash}.css`
      writeFileSync(path.join(outDir, fileName), legacyCss)
      writeFileSync(htmlPath, htmlSource.replace(LEGACY_HREF_PLACEHOLDER, `/${fileName}`))
    },
  }
}

export { legacyCssPlugin }
