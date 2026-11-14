import {
  binToHex,
  decodePrivateKeyWif,
  encodePrivateKeyWif,
  generatePrivateKey,
  hexToBin,
  publicKeyToP2pkhCashAddress,
  secp256k1,
  type CashAddressNetworkPrefix,
} from '@bitauth/libauth'
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools'
import type { BchNetwork } from './constants.ts'
import { CASHADDR_PREFIX } from './constants.ts'

export type BchKeypair = {
  privateKeyHex: string
  publicKeyHex: string
  cashaddr: string
  wif: string
  network: BchNetwork
}

export type NostrKeypair = {
  secretKeyHex: string
  publicKeyHex: string
  nsec: string
  npub: string
}

export function prefixFor(network: BchNetwork): CashAddressNetworkPrefix {
  return CASHADDR_PREFIX[network]
}

export function generateBchKeypair(network: BchNetwork): BchKeypair {
  const privateKey = generatePrivateKey()
  return bchKeypairFromPrivateKey(privateKey, network)
}

export function bchKeypairFromPrivateKey(
  privateKey: Uint8Array,
  network: BchNetwork,
): BchKeypair {
  const publicKey = secp256k1.derivePublicKeyCompressed(privateKey)
  if (typeof publicKey === 'string') throw new Error(publicKey)
  const { address } = publicKeyToP2pkhCashAddress({
    publicKey,
    prefix: prefixFor(network),
  })
  const wifType = network === 'mainnet' ? 'mainnet' : 'testnet'
  return {
    privateKeyHex: binToHex(privateKey),
    publicKeyHex: binToHex(publicKey),
    cashaddr: address,
    wif: encodePrivateKeyWif(privateKey, wifType),
    network,
  }
}

export function bchKeypairFromWif(wif: string, network: BchNetwork): BchKeypair {
  const decoded = decodePrivateKeyWif(wif)
  if (typeof decoded === 'string') throw new Error(decoded)
  return bchKeypairFromPrivateKey(decoded.privateKey, network)
}

export function bchKeypairFromHex(privateKeyHex: string, network: BchNetwork): BchKeypair {
  return bchKeypairFromPrivateKey(hexToBin(privateKeyHex), network)
}

export function generateNostrKeypair(): NostrKeypair {
  const secretKey = generateSecretKey()
  return nostrKeypairFromSecret(secretKey)
}

export function nostrKeypairFromSecret(secretKey: Uint8Array): NostrKeypair {
  const publicKeyHex = getPublicKey(secretKey)
  return {
    secretKeyHex: binToHex(secretKey),
    publicKeyHex,
    nsec: nip19.nsecEncode(secretKey),
    npub: nip19.npubEncode(publicKeyHex),
  }
}

export function nostrKeypairFromNsec(nsec: string): NostrKeypair {
  const decoded = nip19.decode(nsec)
  if (decoded.type !== 'nsec') throw new Error('That is not an nsec.')
  return nostrKeypairFromSecret(decoded.data)
}

export function decodeNpub(npubOrHex: string): string {
  const trimmed = npubOrHex.trim()
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return trimmed.toLowerCase()
  const decoded = nip19.decode(trimmed)
  if (decoded.type !== 'npub') throw new Error('That is not an npub.')
  return decoded.data
}

export function encodeNpub(publicKeyHex: string): string {
  return nip19.npubEncode(publicKeyHex)
}
