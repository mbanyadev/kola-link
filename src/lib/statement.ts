import {
  binToHex,
  hash256,
  hexToBin,
  sha256,
  utf8ToBin,
} from '@bitauth/libauth'
import { PROTOCOL_VERSION } from './constants.ts'

export type BindingStatement = {
  version: typeof PROTOCOL_VERSION
  npubHex: string
  cashaddr: string
  created: number
  nonce: string
}

const HEX64 = /^[0-9a-f]{64}$/
const NONCE = /^[0-9a-f]{16,64}$/

export function randomNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return binToHex(bytes)
}

export function encodeStatement(statement: BindingStatement): string {
  return [
    statement.version,
    `npub=${statement.npubHex}`,
    `bch=${statement.cashaddr}`,
    `created=${statement.created}`,
    `nonce=${statement.nonce}`,
  ].join('|')
}

export function parseStatement(encoded: string): BindingStatement {
  const parts = encoded.split('|')
  if (parts.length !== 5 || parts[0] !== PROTOCOL_VERSION) {
    throw new Error('Statement is not a kola-link:v1 binding.')
  }
  const fields = new Map<string, string>()
  for (const part of parts.slice(1)) {
    const cut = part.indexOf('=')
    if (cut <= 0) throw new Error('Statement field is malformed.')
    fields.set(part.slice(0, cut), part.slice(cut + 1))
  }
  const npubHex = fields.get('npub') ?? ''
  const cashaddr = fields.get('bch') ?? ''
  const createdRaw = fields.get('created') ?? ''
  const nonce = fields.get('nonce') ?? ''
  const created = Number(createdRaw)
  if (!HEX64.test(npubHex)) throw new Error('npub must be 32-byte hex.')
  if (!cashaddr.includes(':')) throw new Error('bch must be a cashaddr with prefix.')
  if (!Number.isInteger(created) || created <= 0) {
    throw new Error('created must be a unix timestamp.')
  }
  if (!NONCE.test(nonce)) throw new Error('nonce must be 8–32 random bytes hex.')
  return {
    version: PROTOCOL_VERSION,
    npubHex,
    cashaddr,
    created,
    nonce,
  }
}

/** SHA-256 of the canonical statement string (32-byte commitment). */
export function statementCommitment(encoded: string): Uint8Array {
  return sha256.hash(utf8ToBin(encoded))
}

export function statementCommitmentHex(encoded: string): string {
  return binToHex(statementCommitment(encoded))
}

/** hash256 used by the Bitcoin Signed Message scheme (double SHA-256). */
export function hash256Message(payload: Uint8Array): Uint8Array {
  return hash256(payload)
}

export function commitmentFromHex(hex: string): Uint8Array {
  if (!HEX64.test(hex)) throw new Error('Commitment must be 32-byte hex.')
  return hexToBin(hex)
}
