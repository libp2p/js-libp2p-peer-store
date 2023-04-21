import { isMultiaddr, multiaddr } from '@multiformats/multiaddr'
import type { Address as AddressPB } from '../pb/peer.js'
import type { Address } from '@libp2p/interface-peer-store'

export function dedupeAddresses (...addresses: Array<Address | AddressPB | undefined>): AddressPB[] {
  const addressMap = new Map<string, AddressPB>()

  addresses.forEach(addr => {
    if (addr == null) {
      return
    }

    if (addr.multiaddr instanceof Uint8Array) {
      addr.multiaddr = multiaddr(addr.multiaddr)
    }

    if (!isMultiaddr(addr.multiaddr)) {
      return
    }

    const isCertified = addr.isCertified ?? false
    const maStr = addr.multiaddr.toString()
    const existingAddr = addressMap.get(maStr)

    if (existingAddr != null) {
      addr.isCertified = existingAddr.isCertified === true || isCertified
    } else {
      addressMap.set(maStr, {
        multiaddr: addr.multiaddr.bytes,
        isCertified
      })
    }
  })

  return [...addressMap.values()].sort((a, b) => {
    return a.multiaddr.toString().localeCompare(b.multiaddr.toString())
  })
}
