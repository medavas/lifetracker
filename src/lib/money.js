/**
 * Money is integer CENTS everywhere in the store and lib layer; these
 * helpers are the only place dollars-as-text exists. parseAmount rejects
 * anything that is not a positive amount — callers treat null as
 * "don't submit".
 */

export function parseAmount(str) {
  if (typeof str !== 'string') return null
  const cleaned = str.replace(/[$,\s]/g, '')
  const m = /^(\d+)(?:\.(\d+))?$/.exec(cleaned)
  if (!m) return null
  const whole = m[1]
  const frac = m[2] || ''
  let cents
  if (frac.length > 2) {
    cents = parseInt(whole + frac.slice(0, 2), 10)
    if (frac[2] >= '5') cents += 1
  } else {
    cents = parseInt(whole + frac.padEnd(2, '0'), 10)
  }
  return cents > 0 ? cents : null
}

export function formatCents(cents) {
  const c = cents ?? 0
  const sign = c < 0 ? '-' : ''
  const abs = Math.abs(c)
  const dollars = Math.floor(abs / 100).toLocaleString('en-US')
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, '0')}`
}

export function centsToInput(cents) {
  return ((cents ?? 0) / 100).toFixed(2)
}
