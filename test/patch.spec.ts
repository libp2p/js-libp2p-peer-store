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

const addr1 = multiaddr('/ip4/127.0.0.1/tcp/8000')
const addr2 = multiaddr('/ip4/20.0.0.1/tcp/8001')
const addr3 = multiaddr('/ip4/127.0.0.1/tcp/8002')

describe('patch', () => {
  let peerId: PeerId
  let otherPeerId: PeerId
  let peerStore: PersistentPeerStore

  beforeEach(async () => {
    peerId = await createEd25519PeerId()
    otherPeerId = await createEd25519PeerId()
    peerStore = new PersistentPeerStore({ peerId, datastore: new MemoryDatastore() })
  })

  it('emits peer:update event on patch', async () => {
    const eventPromise = pEvent(peerStore, 'peer:update')

    await peerStore.patch(otherPeerId, {
      multiaddrs: [addr1, addr2]
    })

    await eventPromise
  })

  it('emits self:peer:update event on patch for self peer', async () => {
    const eventPromise = pEvent(peerStore, 'self:peer:update')

    await peerStore.patch(peerId, {
      multiaddrs: [addr1, addr2]
    })

    await eventPromise
  })

  it('replaces multiaddrs', async () => {
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
      multiaddrs: [
        addr3
      ]
    }

    const updated = await peerStore.patch(otherPeerId, peerUpdate)

    expect(updated).to.have.property('addresses').that.deep.equals([{
      multiaddr: addr3,
      isCertified: false
    }])
  })

  it('replaces metadata', async () => {
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

    await peerStore.patch(peerId, peer)

    const peerUpdate: PeerData = {
      metadata: {
        bar: Uint8Array.from([3, 4, 5])
      }
    }

    const updated = await peerStore.patch(otherPeerId, peerUpdate)

    expect(updated).to.have.property('metadata').that.deep.equals(
      new Map([['bar', Uint8Array.from([3, 4, 5])]])
    )
  })

  it('replaces tags', async () => {
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

    await peerStore.patch(peerId, peer)

    const peerUpdate: PeerData = {
      tags: {
        tag2: { value: 20 }
      }
    }

    const updated = await peerStore.patch(otherPeerId, peerUpdate)

    expect(updated).to.have.property('tags').that.deep.equals(
      new Map([['tag2', { value: 20 }]])
    )
  })
})
