import type { EventEmitter } from '@libp2p/interfaces/events'
import { PersistentStore, PeerUpdate } from './store.js'
import type { PeerStore, Peer, PeerData } from '@libp2p/interface-peer-store'
import type { PeerId } from '@libp2p/interface-peer-id'
import type { Datastore } from 'interface-datastore'
import type { Multiaddr } from '@multiformats/multiaddr'
import type { Libp2pEvents } from '@libp2p/interface-libp2p'

export interface PersistentPeerStoreComponents {
  peerId: PeerId
  datastore: Datastore
  events: EventEmitter<Libp2pEvents>
}

export interface AddressFilter {
  (peerId: PeerId, multiaddr: Multiaddr): Promise<boolean>
}

export interface PersistentPeerStoreInit {
  addressFilter?: AddressFilter
}

/**
 * An implementation of PeerStore that stores data in a Datastore
 */
export class PersistentPeerStore implements PeerStore {
  private readonly store: PersistentStore
  private readonly events: EventEmitter<Libp2pEvents>
  private readonly peerId: PeerId

  constructor (components: PersistentPeerStoreComponents, init: PersistentPeerStoreInit = {}) {
    this.events = components.events
    this.peerId = components.peerId
    this.store = new PersistentStore(components)
  }

  async forEach (fn: (peer: Peer) => void): Promise<void> {
    for await (const peer of this.store.all()) {
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

    if (this.peerId.equals(id)) {
      this.events.safeDispatchEvent('self:peer:update', { detail: result })
    } else {
      this.events.safeDispatchEvent('peer:update', { detail: result })
    }
  }
}
