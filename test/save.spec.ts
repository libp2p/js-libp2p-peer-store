/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 6] */

import { expect } from 'aegir/chai'
import { multiaddr } from '@multiformats/multiaddr'
import type { PeerId } from '@libp2p/interface-peer-id'
import pDefer from 'p-defer'
import { MemoryDatastore } from 'datastore-core/memory'
import { PersistentPeerStore } from '../src/index.js'
import { codes } from '../src/errors.js'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { pEvent } from 'p-event'
import sinon from 'sinon'
import type { PeerUpdate } from '@libp2p/interface-libp2p'

const addr1 = multiaddr('/ip4/127.0.0.1/tcp/8000')
const addr2 = multiaddr('/ip4/20.0.0.1/tcp/8001')

describe('save', () => {
  let peerId: PeerId
  let otherPeerId: PeerId
  let peerStore: PersistentPeerStore

  beforeEach(async () => {
    peerId = await createEd25519PeerId()
    otherPeerId = await createEd25519PeerId()
    peerStore = new PersistentPeerStore({ peerId, datastore: new MemoryDatastore() })
  })

  it('throws invalid parameters error if invalid PeerId is provided', async () => {
    // @ts-expect-error invalid input
    await expect(peerStore.save('invalid peerId'))
      .to.eventually.be.rejected.with.property('code', codes.ERR_INVALID_PARAMETERS)
  })

  it('throws invalid parameters error if no peer data provided', async () => {
    // @ts-expect-error invalid input
    await expect(peerStore.save(peerId))
      .to.eventually.be.rejected.with.property('code', codes.ERR_INVALID_PARAMETERS)
  })

  it('throws invalid parameters error if invalid multiaddrs are provided', async () => {
    await expect(peerStore.save(peerId, {
      // @ts-expect-error invalid input
      addresses: ['invalid multiaddr']
    }))
      .to.eventually.be.rejected.with.property('code', codes.ERR_INVALID_PARAMETERS)
  })

  it('replaces the stored content by default and emit change event', async () => {
    const supportedMultiaddrs = [addr1, addr2]
    const eventPromise = pEvent(peerStore, 'peer:update')

    await peerStore.save(otherPeerId, {
      multiaddrs: supportedMultiaddrs
    })

    const event = await eventPromise as CustomEvent<PeerUpdate>

    const { peer, previous } = event.detail

    expect(peer.addresses).to.deep.equal(
      supportedMultiaddrs.map((multiaddr) => ({
        isCertified: false,
        multiaddr
      }))
    )
    expect(previous).to.be.undefined()
  })

  it('emits on set if not storing the exact same content', async () => {
    const defer = pDefer()

    const supportedMultiaddrsA = [addr1, addr2]
    const supportedMultiaddrsB = [addr2]

    let changeCounter = 0
    peerStore.addEventListener('peer:update', () => {
      changeCounter++
      if (changeCounter > 1) {
        defer.resolve()
      }
    })

    // set 1
    await peerStore.save(otherPeerId, {
      multiaddrs: supportedMultiaddrsA
    })

    // set 2
    await peerStore.save(otherPeerId, {
      multiaddrs: supportedMultiaddrsB
    })

    const peer = await peerStore.get(otherPeerId)
    const multiaddrs = peer.addresses.map((mi) => mi.multiaddr)
    expect(multiaddrs).to.have.deep.members(supportedMultiaddrsB)

    await defer.promise
  })

  it('emits self event on save for self peer', async () => {
    const eventPromise = pEvent(peerStore, 'self:peer:update')

    await peerStore.save(peerId, {
      multiaddrs: [addr1, addr2]
    })

    await eventPromise
  })

  it('does not emit on set if it is storing the exact same content', async () => {
    const defer = pDefer()

    const supportedMultiaddrs = [addr1, addr2]

    let changeCounter = 0
    peerStore.addEventListener('peer:update', () => {
      changeCounter++
      if (changeCounter > 1) {
        defer.reject(new Error('Saved identical data twice'))
      }
    })

    // set 1
    await peerStore.save(otherPeerId, {
      multiaddrs: supportedMultiaddrs
    })

    // set 2 (same content)
    await peerStore.save(otherPeerId, {
      multiaddrs: supportedMultiaddrs
    })

    // Wait 50ms for incorrect second event
    setTimeout(() => {
      defer.resolve()
    }, 50)

    await defer.promise
  })

  it('should not set public key when key does not match', async () => {
    const edKey = await createEd25519PeerId()

    if (peerId.publicKey == null) {
      throw new Error('Public key was missing')
    }

    await expect(peerStore.save(edKey, {
      publicKey: peerId.publicKey
    })).to.eventually.be.rejectedWith(/bytes do not match/)
  })

  it('should not store a public key if already stored', async () => {
    // @ts-expect-error private fields
    const spy = sinon.spy(peerStore.store.components.datastore, 'put')

    if (otherPeerId.publicKey == null) {
      throw new Error('Public key was missing')
    }

    // Set PeerId
    await peerStore.save(otherPeerId, {
      publicKey: otherPeerId.publicKey
    })
    await peerStore.save(otherPeerId, {
      publicKey: otherPeerId.publicKey
    })

    expect(spy).to.have.property('callCount', 1)
  })
})
