import { CodeError } from '@libp2p/interfaces/errors'
import { codes } from '../errors.js'

/**
 * a takes priority
 */
export function dedupeMetadata (a: Map<string, Uint8Array>, b?: Map<string, Uint8Array>): Map<string, Uint8Array> {
  if (b == null) {
    return a
  }

  const output = new Map<string, Uint8Array>([...b.entries(), ...a.entries()])

  for (const key of output.keys()) {
    if (typeof key !== 'string') {
      throw new CodeError('Peer metadata keys must be strings', codes.ERR_INVALID_PARAMETERS)
    }

    if (!(output.get(key) instanceof Uint8Array)) {
      throw new CodeError('Peer metadata values must be Uint8Arrays', codes.ERR_INVALID_PARAMETERS)
    }
  }

  return output
}
