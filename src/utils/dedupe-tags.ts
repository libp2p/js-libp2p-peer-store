import type { Tag as TagPB } from '../pb/peer.js'

/**
 * a takes priority
 */
export function dedupeTags (a: Map<string, TagPB>, b?: Map<string, TagPB>): Map<string, TagPB> {
  if (b == null) {
    return a
  }

  const output = new Map<string, TagPB>([...b.entries(), ...a.entries()])

  for (const [key, tag] of output.entries()) {
    output.set(key, {
      value: tag.value ?? 0,
      expiry: tag.expiry
    })
  }

  return output
}
