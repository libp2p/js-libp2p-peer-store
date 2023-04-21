
import { CodeError } from '@libp2p/interfaces/errors'
import { codes } from '../errors.js'
import { isMultiaddr } from '@multiformats/multiaddr'
import type { Peer as PeerPB } from '../pb/peer.js'
import { equals as uint8arrayEquals } from 'uint8arrays/equals'
import type { PeerData, TagOptions } from '@libp2p/interface-peer-store'
import type { PeerId } from '@libp2p/interface-peer-id'

export function toDatastorePeer (peerId: PeerId, data: PeerData): PeerPB {
  if (data == null) {
    throw new CodeError('Invalid PeerData', codes.ERR_INVALID_PARAMETERS)
  }

  if (data.publicKey != null && peerId.publicKey != null && !uint8arrayEquals(data.publicKey, peerId.publicKey)) {
    throw new CodeError('publicKey bytes do not match peer id publicKey bytes', codes.ERR_INVALID_PARAMETERS)
  }

  // merge addresses and multiaddrs, and dedupe
  const addressSet = new Set()

  const output: PeerPB = {
    addresses: (data.addresses ?? [])
      .concat((data.multiaddrs ?? []).map(multiaddr => ({ multiaddr, isCertified: false })))
      .filter(address => {
        if (!isMultiaddr(address.multiaddr)) {
          throw new CodeError('Invalid mulitaddr', codes.ERR_INVALID_PARAMETERS)
        }

        if (addressSet.has(address.multiaddr.toString())) {
          return false
        }

        addressSet.add(address.multiaddr.toString())
        return true
      })
      .sort((a, b) => {
        return a.multiaddr.toString().localeCompare(b.multiaddr.toString())
      })
      .map(({ multiaddr, isCertified }) => ({
        multiaddr: multiaddr.bytes,
        isCertified
      })),
    protocols: (data.protocols ?? []).sort(),
    metadata: new Map(),
    tags: new Map(),
    publicKey: data.publicKey,
    peerRecordEnvelope: data.peerRecordEnvelope
  }

  // remove invalid metadata
  if (data.metadata != null) {
    if (data.metadata instanceof Map) {
      output.metadata = data.metadata
    } else {
      for (const [key, value] of Object.entries(data.metadata)) {
        output.metadata.set(key, value)
      }
    }

    for (const key of output.metadata.keys()) {
      if (typeof key !== 'string') {
        throw new CodeError('Peer metadata keys must be strings', codes.ERR_INVALID_PARAMETERS)
      }

      if (!(output.metadata.get(key) instanceof Uint8Array)) {
        throw new CodeError('Peer metadata values must be Uint8Arrays', codes.ERR_INVALID_PARAMETERS)
      }
    }
  }

  if (data.tags != null) {
    let tagOptions: Map<string, TagOptions>

    if (data.tags instanceof Map) {
      tagOptions = data.tags
    } else {
      tagOptions = new Map()

      for (const [key, value] of Object.entries(data.tags)) {
        tagOptions.set(key, value)
      }
    }

    for (const [key, options] of tagOptions.entries()) {
      const tag = {
        name: key,
        ttl: options.ttl,
        value: options.value ?? 0
      }

      if (tag.value < 0 || tag.value > 100) {
        throw new CodeError('Tag value must be between 0-100', codes.ERR_INVALID_PARAMETERS)
      }

      if (parseInt(`${tag.value}`, 10) !== tag.value) {
        throw new CodeError('Tag value must be an integer', codes.ERR_INVALID_PARAMETERS)
      }

      if (tag.ttl != null) {
        if (tag.ttl < 0) {
          throw new CodeError('Tag ttl must be between greater than 0', codes.ERR_INVALID_PARAMETERS)
        }

        if (parseInt(`${tag.ttl}`, 10) !== tag.ttl) {
          throw new CodeError('Tag ttl must be an integer', codes.ERR_INVALID_PARAMETERS)
        }
      }

      output.tags.set(tag.name, {
        value: tag.value,
        expiry: tag.ttl == null ? undefined : BigInt(Date.now() + tag.ttl)
      })
    }
  }

  return output
}
