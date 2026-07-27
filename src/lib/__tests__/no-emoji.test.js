import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Emoji blocks, dingbats (✓ ✔), variation selector, arrows (← →), misc pictographs.
// eslint-disable-next-line no-misleading-character-class -- intentional: banning the lone variation-selector code point, not a combining sequence
const BANNED = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}]/u

const SRC = fileURLToPath(new URL('../../', import.meta.url))

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === '__tests__' || e.name === 'node_modules') return []
    const p = join(dir, e.name)
    if (e.isDirectory()) return walk(p)
    return /\.(jsx?|css|html)$/.test(e.name) ? [p] : []
  })
}

describe('professional UI', () => {
  it('contains no emoji or dingbat glyphs in src/', () => {
    const offenders = []
    for (const file of walk(SRC)) {
      const text = readFileSync(file, 'utf8')
      const m = text.match(BANNED)
      if (m) offenders.push(`${file} → "${m[0]}"`)
    }
    expect(offenders).toEqual([])
  })
})
