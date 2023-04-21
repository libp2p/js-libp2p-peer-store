/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { dedupeTags } from '../../src/utils/dedupe-tags.js'

describe('dedupe-tags', () => {
  it('should dedupe tags', () => {
    expect(dedupeTags(
      new Map([['tag', { value: 20 }]]),
      new Map([['tag', { value: 10 }]])
    )).to.deep.equal(
      new Map([['tag', { value: 20, expiry: undefined }]])
    )
  })

  it('should only require one argument', () => {
    expect(dedupeTags(
      new Map([['tag', { value: 10 }]])
    )).to.deep.equal(
      new Map([['tag', { value: 10 }]])
    )
  })

  it('should sort tags', () => {
    expect(dedupeTags(
      new Map([['btag', { value: 20 }]]),
      new Map([['atag', { value: 10 }]])
    )).to.deep.equal(
      new Map([
        ['atag', { value: 10, expiry: undefined }],
        ['btag', { value: 20, expiry: undefined }]
      ])
    )
  })
})
