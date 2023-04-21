/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { dedupeMetadata } from '../../src/utils/dedupe-metadata.js'

describe('dedupe-metadata', () => {
  it('should dedupe tags', () => {
    expect(dedupeMetadata(
      new Map([['a-key', Uint8Array.from([0, 1, 2, 3])]]),
      new Map([['a-key', Uint8Array.from([4, 5, 6, 7])]])
    )).to.deep.equal(
      new Map([['a-key', Uint8Array.from([0, 1, 2, 3])]])
    )
  })

  it('should only require one argument', () => {
    expect(dedupeMetadata(
      new Map([['a-key', Uint8Array.from([0, 1, 2, 3])]])
    )).to.deep.equal(
      new Map([['a-key', Uint8Array.from([0, 1, 2, 3])]])
    )
  })

  it('should sort tags', () => {
    expect(dedupeMetadata(
      new Map([['b-key', Uint8Array.from([0, 1, 2, 3])]]),
      new Map([['a-key', Uint8Array.from([4, 5, 6, 7])]])
    )).to.deep.equal(
      new Map([
        ['a-key', Uint8Array.from([4, 5, 6, 7])],
        ['b-key', Uint8Array.from([0, 1, 2, 3])]
      ])
    )
  })
})
