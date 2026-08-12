import { describe, it, expect } from 'vitest'
import { onEnter, onTab, lettersFor, markerFor } from '../outline'

describe('lettersFor', () => {
  it('counts a, b, c ... z, then wraps to aa', () => {
    expect(lettersFor(1)).toBe('a')
    expect(lettersFor(2)).toBe('b')
    expect(lettersFor(26)).toBe('z')
    expect(lettersFor(27)).toBe('aa')
    expect(lettersFor(28)).toBe('ab')
  })
})

describe('markerFor', () => {
  it('renders each style', () => {
    expect(markerFor('bullet', 5)).toBe('- ')
    expect(markerFor('number', 3)).toBe('3. ')
    expect(markerFor('letter', 2)).toBe('b. ')
  })
})

describe('onEnter', () => {
  it('returns null on a plain (non-marked) line', () => {
    expect(onEnter('just some text', 5)).toBeNull()
  })

  it('continues a bullet', () => {
    const value = '- first'
    const res = onEnter(value, value.length)
    expect(res.value).toBe('- first\n- ')
    expect(res.cursor).toBe(res.value.length)
  })

  it('increments a numbered marker', () => {
    const value = '1. first'
    const res = onEnter(value, value.length)
    expect(res.value).toBe('1. first\n2. ')
  })

  it('increments a lettered marker', () => {
    const value = 'b. second'
    const res = onEnter(value, value.length)
    expect(res.value).toBe('b. second\nc. ')
  })

  it('splits line content at the cursor rather than always at the end', () => {
    const value = '- helloworld'
    const cursor = '- hello'.length
    const res = onEnter(value, cursor)
    expect(res.value).toBe('- hello\n- world')
  })

  it('preserves indentation when continuing a nested marker', () => {
    const value = 'a. first\n  1. nested'
    const res = onEnter(value, value.length)
    expect(res.value).toBe('a. first\n  1. nested\n  2. ')
  })

  it('clears the marker on an empty item instead of continuing it', () => {
    const value = '- first\n- '
    const res = onEnter(value, value.length)
    expect(res.value).toBe('- first\n')
    expect(res.cursor).toBe(res.value.length)
  })
})

describe('onTab', () => {
  it('returns null for shift+tab at the left margin', () => {
    expect(onTab('- item', 3, true)).toBeNull()
  })

  it('indents a marked line and switches bullet -> number for depth 1', () => {
    const value = '- item'
    const res = onTab(value, value.length, false)
    expect(res.value).toBe('  1. item')
  })

  it('indents twice and reaches letter style at depth 2', () => {
    let value = '- item'
    let res = onTab(value, value.length, false)
    res = onTab(res.value, res.value.length, false)
    expect(res.value).toBe('    a. item')
  })

  it('continues the right sequence number among siblings at the target depth', () => {
    const value = '- one\n  1. a\n  2. b\n- two'
    const lastLineStart = value.lastIndexOf('\n') + 1
    const res = onTab(value, lastLineStart + '- two'.length, false)
    expect(res.value).toBe('- one\n  1. a\n  2. b\n  3. two')
  })

  it('shift+tab outdents back toward bullet style', () => {
    const value = '  1. item'
    const res = onTab(value, value.length, true)
    expect(res.value).toBe('- item')
  })

  it('indents a plain (unmarked) line without inventing a marker', () => {
    const value = 'plain line'
    const res = onTab(value, value.length, false)
    expect(res.value).toBe('  plain line')
  })

  it('a shallower line above ends the run and restarts numbering at 1', () => {
    const value = '- top\n  1. apple\n- other\n- child'
    const lastLineStart = value.lastIndexOf('\n') + 1
    const res = onTab(value, lastLineStart + '- child'.length, false)
    expect(res.value).toBe('- top\n  1. apple\n- other\n  1. child')
  })
})
