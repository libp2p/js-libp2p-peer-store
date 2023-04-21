/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 6] */

import { expect } from 'aegir/chai'
import { multiaddr } from '@multiformats/multiaddr'
import type { PeerId } from '@libp2p/interface-peer-id'
import { MemoryDatastore } from 'datastore-core/memory'
import { PersistentPeerStore } from '../src/index.js'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import type { PeerData } from '@libp2p/interface-peer-store'
import { pEvent } from 'p-event'
import { EventEmitter } from '@libp2p/interfaces/events'
import type { Libp2pEvents } from '@libp2p/interface-libp2p'

const addr1 = multiaddr('/ip4/127.0.0.1/tcp/8000')
const addr2 = multiaddr('/ip4/20.0.0.1/tcp/8001')
const addr3 = multiaddr('/ip4/127.0.0.1/tcp/8002')

describe('merge', () => {
  let peerId: PeerId
  let otherPeerId: PeerId
  let peerStore: PersistentPeerStore
  let events: EventEmitter<Libp2pEvents>

  beforeEach(async () => {
    peerId = await createEd25519PeerId()
    otherPeerId = await createEd25519PeerId()
    events = new EventEmitter()
    peerStore = new PersistentPeerStore({ peerId, events, datastore: new MemoryDatastore() })
  })

  it('emits peer:update event on merge', async () => {
    const eventPromise = pEvent(events, 'peer:update')

    await peerStore.merge(otherPeerId, {
      multiaddrs: [addr1, addr2]
    })

    await eventPromise
  })

  it('emits self:peer:update event on merge for self peer', async () => {
    const eventPromise = pEvent(events, 'self:peer:update')

    await peerStore.merge(peerId, {
      multiaddrs: [addr1, addr2]
    })

    await eventPromise
  })

  it('merges multiaddrs', async () => {
    const peer: PeerData = {
      multiaddrs: [
        addr1,
        addr2
      ],
      metadata: {
        foo: Uint8Array.from([0, 1, 2])
      },
      tags: {
        tag1: { value: 10 }
      }
    }

    await peerStore.save(otherPeerId, peer)

    const updated = await peerStore.merge(otherPeerId, {
      multiaddrs: [
        addr3
      ]
    })

    expect(updated).to.have.property('addresses').that.deep.equals([{
      multiaddr: addr1,
      isCertified: false
    }, {
      multiaddr: addr3,
      isCertified: false
    }, {
      multiaddr: addr2,
      isCertified: false
    }])
  })

  it('merges metadata', async () => {
    const peer: PeerData = {
      multiaddrs: [
        addr1,
        addr2
      ],
      metadata: {
        foo: Uint8Array.from([0, 1, 2])
      },
      tags: {
        tag1: { value: 10 }
      }
    }

    await peerStore.save(otherPeerId, peer)

    const peerUpdate: PeerData = {
      metadata: {
        bar: Uint8Array.from([3, 4, 5])
      }
    }

    const updated = await peerStore.merge(otherPeerId, peerUpdate)

    expect(updated).to.have.property('metadata').that.deep.equals(
      new Map([
        ['foo', Uint8Array.from([0, 1, 2])],
        ['bar', Uint8Array.from([3, 4, 5])]
      ])
    )
  })

  it('merges tags', async () => {
    const peer: PeerData = {
      multiaddrs: [
        addr1,
        addr2
      ],
      metadata: {
        foo: Uint8Array.from([0, 1, 2])
      },
      tags: {
        tag1: { value: 10 }
      }
    }

    await peerStore.patch(otherPeerId, peer)

    const peerUpdate: PeerData = {
      tags: {
        tag2: { value: 20 }
      }
    }

    const updated = await peerStore.merge(otherPeerId, peerUpdate)

    expect(updated).to.have.property('tags').that.deep.equals(
      new Map([
        ['tag1', { value: 10 }],
        ['tag2', { value: 20 }]
      ])
    )
  })
})