/**
 * Plain-text outline behavior for a textarea. The marker is literal text the
 * user typed ("- ", "1. ", "a. ") -- nothing renders as rich text, so what's
 * stored is exactly what's shown. Two operations:
 *
 *  - onEnter: continuing a marked line inserts the same style on the next
 *    line, incrementing a number/letter; an empty marked line instead clears
 *    its own marker (the "empty enter exits the list" convention most
 *    outliners share). A plain line returns null so the caller falls back to
 *    the browser's default newline.
 *  - onTab: reindents the current line by one level (2 spaces) and rewrites
 *    its marker to match the new depth's style, continuing the right
 *    sequence number from the nearest sibling already at that depth. A line
 *    with no marker just gains/loses indentation. Returns null when there is
 *    nothing to do (e.g. shift+tab at the left margin), so the caller can
 *    still swallow the keypress without changing anything.
 *
 * Both take the plain string value and a collapsed cursor offset, and return
 * { value, cursor } or null -- no DOM, no React, easy to unit test.
 */

const MARKER_RE = /^( *)([-*]|\d+\.|[a-zA-Z]+\.) (.*)$/

export const styleForDepth = (depth) => (depth % 3 === 0 ? 'bullet' : depth % 3 === 1 ? 'number' : 'letter')

/** 1 -> 'a', 26 -> 'z', 27 -> 'aa' -- spreadsheet-column-style base26, no zero digit. */
export function lettersFor(n) {
  let s = ''
  let i = n
  while (i > 0) {
    i--
    s = String.fromCharCode(97 + (i % 26)) + s
    i = Math.floor(i / 26)
  }
  return s
}

function lettersToNumber(s) {
  let n = 0
  for (const ch of s.toLowerCase()) n = n * 26 + (ch.charCodeAt(0) - 96)
  return n
}

export const markerFor = (style, seq) =>
  style === 'bullet' ? '- ' : style === 'number' ? `${seq}. ` : `${lettersFor(seq)}. `

function seqOf(style, marker) {
  if (style === 'number') return parseInt(marker, 10)
  if (style === 'letter') return lettersToNumber(marker.slice(0, -1))
  return 1
}

function parseLine(line) {
  const m = MARKER_RE.exec(line)
  if (!m) return null
  const [, indent, marker, content] = m
  const style = /^[-*]$/.test(marker) ? 'bullet' : /^\d+\.$/.test(marker) ? 'number' : 'letter'
  return { indent, marker, style, content, prefixLen: indent.length + marker.length + 1 }
}

function splitLines(value) {
  return value.split('\n')
}

function offsetOf(lines, lineIndex, col) {
  let off = 0
  for (let i = 0; i < lineIndex; i++) off += lines[i].length + 1
  return off + col
}

/** Locate the line + column a flat cursor offset falls on. */
function locate(value, pos) {
  const lines = splitLines(value)
  let off = 0
  for (let i = 0; i < lines.length; i++) {
    const len = lines[i].length
    if (pos <= off + len) return { lines, lineIndex: i, col: pos - off }
    off += len + 1
  }
  const last = lines.length - 1
  return { lines, lineIndex: last, col: lines[last].length }
}

/**
 * Next sequence number for a marker at `indentLen` spaces, scanning upward
 * from just above `lineIndex`. Deeper child lines are skipped over; the
 * first line at exactly `indentLen` decides the answer (its seq + 1, or a
 * fresh 1 if that line isn't itself a marker); a shallower line ends the
 * run with no match, also a fresh 1.
 */
function nextSeqAbove(lines, lineIndex, indentLen) {
  for (let i = lineIndex - 1; i >= 0; i--) {
    const lead = (lines[i].match(/^ */) || [''])[0].length
    if (lead < indentLen) return 1
    if (lead === indentLen) {
      const parsed = parseLine(lines[i])
      return parsed ? seqOf(parsed.style, parsed.marker) + 1 : 1
    }
    // lead > indentLen: a deeper child of the current run -- keep scanning up.
  }
  return 1
}

export function onEnter(value, pos) {
  const { lines, lineIndex, col } = locate(value, pos)
  const line = lines[lineIndex]
  const parsed = parseLine(line)
  if (!parsed) return null

  const { indent, prefixLen } = parsed
  const isEmptyItem = line.slice(prefixLen).trim() === ''
  if (isEmptyItem) {
    const newLines = [...lines]
    newLines[lineIndex] = indent
    return { value: newLines.join('\n'), cursor: offsetOf(newLines, lineIndex, indent.length) }
  }

  // The current line is itself the new line's immediate predecessor sibling.
  const seq = seqOf(parsed.style, parsed.marker) + 1
  const marker = markerFor(parsed.style, seq)
  const before = line.slice(0, col)
  const after = line.slice(col)
  const newLines = [...lines.slice(0, lineIndex), before, indent + marker + after, ...lines.slice(lineIndex + 1)]
  return { value: newLines.join('\n'), cursor: offsetOf(newLines, lineIndex + 1, (indent + marker).length) }
}

export function onTab(value, pos, shiftKey) {
  const { lines, lineIndex, col } = locate(value, pos)
  const line = lines[lineIndex]
  const curIndent = (line.match(/^ */) || [''])[0].length

  if (shiftKey && curIndent === 0) return null
  const newIndentLen = shiftKey ? Math.max(0, curIndent - 2) : curIndent + 2

  const parsed = parseLine(line)
  let newLine
  let prefixDelta
  if (parsed) {
    const newStyle = styleForDepth(Math.floor(newIndentLen / 2))
    const seq = nextSeqAbove(lines, lineIndex, newIndentLen)
    const marker = markerFor(newStyle, seq)
    newLine = ' '.repeat(newIndentLen) + marker + line.slice(parsed.prefixLen)
    prefixDelta = newIndentLen + marker.length - parsed.prefixLen
  } else {
    newLine = ' '.repeat(newIndentLen) + line.slice(curIndent)
    prefixDelta = newIndentLen - curIndent
  }

  const newLines = [...lines]
  newLines[lineIndex] = newLine
  const newCol = Math.max(newIndentLen, col + prefixDelta)
  return { value: newLines.join('\n'), cursor: offsetOf(newLines, lineIndex, newCol) }
}
