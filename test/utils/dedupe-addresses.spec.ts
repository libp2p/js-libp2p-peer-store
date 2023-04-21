/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { multiaddr } from '@multiformats/multiaddr'
import { dedupeAddresses } from '../../src/utils/dedupe-addresses.js'

const addr1 = multiaddr('/ip4/127.0.0.1/tcp/8000')
const addr2 = multiaddr('/ip4/20.0.0.1/tcp/8001')

describe('dedupe-addresses', () => {
  it('should dedupe addresses', () => {
    expect(dedupeAddresses({
      multiaddr: addr1,
      isCertified: false
    }, {
      multiaddr: addr1,
      isCertified: false
    }, {
      multiaddr: addr2,
      isCertified: false
    })).to.deep.equal([{
      multiaddr: addr1.bytes,
      isCertified: false
    }, {
      multiaddr: addr2.bytes,
      isCertified: false
    }])
  })

  it('should sort addresses', () => {
    expect(dedupeAddresses({
      multiaddr: addr2,
      isCertified: false
    }, {
      multiaddr: addr1,
      isCertified: false
    }, {
      multiaddr: addr1,
      isCertified: false
    })).to.deep.equal([{
      multiaddr: addr1.bytes,
      isCertified: false
    }, {
      multiaddr: addr2.bytes,
      isCertified: false
    }])
  })

  it('should retain isCertified when deduping addresses', () => {
    expect(dedupeAddresses({
      multiaddr: addr1,
      isCertified: true
    }, {
      multiaddr: addr1,
      isCertified: false
    })).to.deep.equal([{
      multiaddr: addr1.bytes,
      isCertified: true
    }])
  })

  it('should survive deduping garbage addresses', () => {
    expect(dedupeAddresses({
      multiaddr: addr1,
      isCertified: false
    // @ts-expect-error invalid params
    }, {}, 'hello', 5, undefined, {
      multiaddr: addr1,
      isCertified: false
    })).to.deep.equal([{
      multiaddr: addr1.bytes,
      isCertified: false
    }])
  })
})
