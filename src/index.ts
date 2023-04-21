import { EventEmitter } from '@libp2p/interfaces/events'
import { PeerUpdate, PersistentStore } from './store.js'
import type { PeerStore, Peer, PeerData } from '@libp2p/interface-peer-store'
import type { PeerId } from '@libp2p/interface-peer-id'
import type { Datastore } from 'interface-datastore'
import type { Multiaddr } from '@multiformats/multiaddr'
import { CodeError } from '@libp2p/interfaces/errors'
import { codes } from './errors.js'

export interface PersistentPeerStoreComponents {
  peerId: PeerId
  datastore: Datastore
}

export interface AddressFilter {
  (peerId: PeerId, multiaddr: Multiaddr): Promise<boolean>
}

export interface PersistentPeerStoreInit {
  addressFilter?: AddressFilter
}

interface PeerStoreEvents {
  /**
   * This event is emitted when the stored data for a peer changes.
   *
   * If the peer store already contained data about the peer it will be set
   * as the `previous` key on the event detail.
   *
   * @example
   *
   * ```js
   * peerStore.addEventListener('peer:update', (event) => {
   *   const { peer, previous } = event.detail
   *   // ...
   * })
   * ```
   */
  'peer:update': CustomEvent<PeerUpdate>

  /**
   * Similar to the 'peer:update' event, this event is dispatched when the
   * updated peer is the current node.
   *
   * @example
   *
   * ```js
   * peerStore.addEventListener('self:peer:update', (event) => {
   *   const { peer, previous } = event.detail
   *   // ...
   * })
   * ```
   */
  'self:peer:update': CustomEvent<PeerUpdate>
}

/**
 * An implementation of PeerStore that stores data in a Datastore
 */
export class PersistentPeerStore extends EventEmitter<PeerStoreEvents> implements PeerStore {
  private readonly components: PersistentPeerStoreComponents
  private readonly store: PersistentStore

  constructor (components: PersistentPeerStoreComponents, init: PersistentPeerStoreInit = {}) {
    super()

    this.components = components
    this.store = new PersistentStore(components)
  }

  async forEach (fn: (peer: Peer) => void): Promise<void> {
    for await (const peer of this.store.all()) {
      if (peer.id.equals(this.components.peerId)) {
        // Skip self peer if present
        continue
      }

      fn(peer)
    }
  }

  async all (): Promise<Peer[]> {
    const output: Peer[] = []

    await this.forEach(peer => {
      output.push(peer)
    })

    return output
  }

  async delete (peerId: PeerId): Promise<void> {
    if (this.components.peerId.equals(peerId)) {
      throw new CodeError('Cannot delete self peer', codes.ERR_INVALID_PARAMETERS)
    }

    await this.store.delete(peerId)
  }

  async has (peerId: PeerId): Promise<boolean> {
    return await this.store.has(peerId)
  }

  async get (peerId: PeerId): Promise<Peer> {
    return await this.store.load(peerId)
  }

  async save (id: PeerId, data: PeerData): Promise<Peer> {
    const result = await this.store.save(id, data)

    this.#emitIfUpdated(id, result)

    return result.peer
  }

  async patch (id: PeerId, data: PeerData): Promise<Peer> {
    const result = await this.store.patch(id, data)

    this.#emitIfUpdated(id, result)

    return result.peer
  }

  async merge (id: PeerId, data: PeerData): Promise<Peer> {
    const result = await this.store.merge(id, data)

    this.#emitIfUpdated(id, result)

    return result.peer
  }

  #emitIfUpdated (id: PeerId, result: PeerUpdate): void {
    if (!result.updated) {
      return
    }

    if (this.components.peerId.equals(id)) {
      this.safeDispatchEvent('self:peer:update', { detail: result })
    } else {
      this.safeDispatchEvent('peer:update', { detail: result })
    }
  }
}
