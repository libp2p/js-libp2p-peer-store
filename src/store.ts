import { peerIdFromBytes } from '@libp2p/peer-id'
import { base32 } from 'multiformats/bases/base32'
import { Peer as PeerPB } from './pb/peer.js'
import type { Peer, PeerData } from '@libp2p/interface-peer-store'
import type { PeerId } from '@libp2p/interface-peer-id'
import type { PersistentPeerStoreComponents } from './index.js'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import { NAMESPACE_COMMON, peerIdToDatastoreKey } from './utils/peer-id-to-datastore-key.js'
import { toDatastorePeer } from './utils/peer-data-to-datastore-peer.js'
import { dedupeAddresses } from './utils/dedupe-addresses.js'
import { dedupeTags } from './utils/dedupe-tags.js'
import { dedupeMetadata } from './utils/dedupe-metadata.js'
import { bytesToPeer } from './utils/bytes-to-peer.js'
import { multiaddr } from '@multiformats/multiaddr'
import { CodeError } from '@libp2p/interfaces/errors'
import { codes } from './errors.js'
import type { Datastore } from 'interface-datastore'
import type { PeerUpdate as PeerUpdateExternal } from '@libp2p/interface-libp2p'

/**
 * Event detail emitted when peer data changes
 */
export interface PeerUpdate extends PeerUpdateExternal {
  updated: boolean
}

export class PersistentStore {
  private readonly peerId: PeerId
  private readonly datastore: Datastore

  constructor (components: PersistentPeerStoreComponents) {
    this.peerId = components.peerId
    this.datastore = components.datastore
  }

  async has (peerId: PeerId): Promise<boolean> {
    return await this.datastore.has(peerIdToDatastoreKey(peerId))
  }

  async delete (peerId: PeerId): Promise<void> {
    if (this.peerId.equals(peerId)) {
      throw new CodeError('Cannot delete self peer', codes.ERR_INVALID_PARAMETERS)
    }

    await this.datastore.delete(peerIdToDatastoreKey(peerId))
  }

  async load (peerId: PeerId): Promise<Peer> {
    const buf = await this.datastore.get(peerIdToDatastoreKey(peerId))

    return await bytesToPeer(peerId, buf)
  }

  async save (peerId: PeerId, data: PeerData): Promise<PeerUpdate> {
    const {
      existingBuf,
      existingPeer
    } = await this.#findExistingPeer(peerId)

    const peerPb: PeerPB = toDatastorePeer(peerId, data)

    return await this.#saveIfDifferent(peerId, peerPb, existingBuf, existingPeer)
  }

  async patch (peerId: PeerId, data: Partial<PeerData>): Promise<PeerUpdate> {
    const {
      existingBuf,
      existingPeer
    } = await this.#findExistingPeer(peerId)

    const peer = toDatastorePeer(peerId, data)

    const peerPb: PeerPB = {
      addresses: dedupeAddresses(...(peer.addresses ?? existingPeer?.addresses ?? [])),
      protocols: [...new Set(peer.protocols ?? existingPeer?.protocols)],
      publicKey: peer.publicKey ?? existingPeer?.id.publicKey,
      peerRecordEnvelope: peer.peerRecordEnvelope ?? existingPeer?.peerRecordEnvelope,
      metadata: peer.metadata ?? existingPeer?.metadata,
      tags: peer.tags ?? existingPeer?.tags
    }

    return await this.#saveIfDifferent(peerId, peerPb, existingBuf, existingPeer)
  }

  async merge (peerId: PeerId, data: PeerData): Promise<PeerUpdate> {
    const {
      existingBuf,
      existingPeer
    } = await this.#findExistingPeer(peerId)

    const peer = toDatastorePeer(peerId, data)
    const peerPb: PeerPB = {
      addresses: dedupeAddresses(...(existingPeer?.addresses ?? []), ...peer.addresses),
      protocols: [...new Set([...(existingPeer?.protocols ?? []), ...peer.protocols])],
      publicKey: peer.publicKey ?? existingPeer?.id.publicKey,
      peerRecordEnvelope: peer.peerRecordEnvelope ?? existingPeer?.peerRecordEnvelope,
      metadata: dedupeMetadata(peer.metadata, existingPeer?.metadata),
      tags: dedupeTags(peer.tags, existingPeer?.tags)
    }

    return await this.#saveIfDifferent(peerId, peerPb, existingBuf, existingPeer)
  }

  async * all (): AsyncGenerator<Peer, void, unknown> {
    for await (const { key, value } of this.datastore.query({
      prefix: NAMESPACE_COMMON
    })) {
      // /peers/${peer-id-as-libp2p-key-cid-string-in-base-32}
      const base32Str = key.toString().split('/')[2]
      const buf = base32.decode(base32Str)
      const peerId = peerIdFromBytes(buf)

      if (peerId.equals(this.peerId)) {
        // Skip self peer if present
        continue
      }

      yield bytesToPeer(peerId, value)
    }
  }

  async #findExistingPeer (peerId: PeerId): Promise<{ existingBuf?: Uint8Array, existingPeer?: Peer }> {
    try {
      const existingBuf = await this.datastore.get(peerIdToDatastoreKey(peerId))
      const existingPeer = await bytesToPeer(peerId, existingBuf)

      return {
        existingBuf,
        existingPeer
      }
    } catch (err: any) {
      if (err.code !== 'ERR_NOT_FOUND') {
        throw err
      }
    }

    return {}
  }

  async #saveIfDifferent (peerId: PeerId, peer: PeerPB, existingBuf?: Uint8Array, existingPeer?: Peer): Promise<PeerUpdate> {
    // sort fields before write so bytes are consistent
    peer.addresses = peer.addresses.sort((a, b) => {
      return multiaddr(a.multiaddr).toString().localeCompare(multiaddr(b.multiaddr).toString())
    })
    peer.protocols = peer.protocols.sort((a, b) => {
      return a.localeCompare(b)
    })
    peer.metadata = sortMapByKeys(peer.metadata)
    peer.tags = sortMapByKeys(peer.tags)

    const buf = PeerPB.encode(peer)

    if (existingBuf != null && uint8ArrayEquals(buf, existingBuf)) {
      return {
        peer: await bytesToPeer(peerId, buf),
        previous: existingPeer,
        updated: false
      }
    }

    await this.datastore.put(peerIdToDatastoreKey(peerId), buf)

    return {
      peer: await bytesToPeer(peerId, buf),
      previous: existingPeer,
      updated: true
    }
  }
}

/**
 * In JS maps are ordered by insertion order so create a new map with the
 * keys inserted in alphabetical order.
 */
function sortMapByKeys <V> (map: Map<string, V>): Map<string, V> {
  const output = new Map()

  for (const key of [...map.keys()].sort((a, b) => {
    return a.localeCompare(b)
  })) {
    output.set(key, map.get(key))
  }

  return output
}
