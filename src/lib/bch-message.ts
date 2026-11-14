import {
  binToBase64,
  base64ToBin,
  binToHex,
  hash256,
  publicKeyToP2pkhCashAddress,
  secp256k1,
  utf8ToBin,
  type CashAddressNetworkPrefix,
  type RecoveryId,
} from '@bitauth/libauth'

const MAGIC = 'Bitcoin Signed Message:\n'

function compactSize(length: number): Uint8Array {
  if (length < 0xfd) return Uint8Array.of(length)
  if (length <= 0xffff) {
    const out = new Uint8Array(3)
    out[0] = 0xfd
    out[1] = length & 0xff
    out[2] = (length >> 8) & 0xff
    return out
  }
  throw new Error('Message is too long to sign.')
}

export function bitcoinSignedMessageHash(message: string): Uint8Array {
  const messageBytes = utf8ToBin(message)
  const magicBytes = utf8ToBin(MAGIC)
  const payload = Uint8Array.from([
    magicBytes.length,
    ...magicBytes,
    ...compactSize(messageBytes.length),
    ...messageBytes,
  ])
  return hash256(payload)
}

/**
 * Sign a statement with a BCH private key using the standard
 * Bitcoin Signed Message scheme (compressed pubkey, header 31–34).
 * Returns a base64 signature. This proves control of the cashaddr
 * without broadcasting a transaction or sharing the private key.
 */
export function signBitcoinMessage(
  message: string,
  privateKey: Uint8Array,
): string {
  const hash = bitcoinSignedMessageHash(message)
  const recoverable = secp256k1.signMessageHashRecoverableCompact(privateKey, hash)
  if (typeof recoverable === 'string') throw new Error(recoverable)
  const header = 31 + recoverable.recoveryId
  const packed = Uint8Array.from([header, ...recoverable.signature])
  return binToBase64(packed)
}

export function recoverMessagePublicKey(
  message: string,
  signatureBase64: string,
): Uint8Array {
  const packed = base64ToBin(signatureBase64)
  if (packed.length !== 65) throw new Error('Signature must be 65 bytes (base64).')
  const header = packed[0]
  if (header < 27 || header > 34) throw new Error('Signature header is not a Bitcoin message signature.')
  const recoveryId = ((header - 27) & 3) as RecoveryId
  const compressed = header >= 31
  const signature = packed.slice(1)
  const hash = bitcoinSignedMessageHash(message)
  const publicKey = secp256k1.recoverPublicKeyCompressed
    ? secp256k1.recoverPublicKeyCompressed(signature, recoveryId, hash)
    : secp256k1.recoverPublicKeyUncompressed(signature, recoveryId, hash)
  if (typeof publicKey === 'string') throw new Error(publicKey)
  if (compressed && publicKey.length === 33) return publicKey
  if (compressed && publicKey.length === 65) {
    const compressedKey = secp256k1.compressPublicKey(publicKey)
    if (typeof compressedKey === 'string') throw new Error(compressedKey)
    return compressedKey
  }
  return publicKey
}

export function verifyBitcoinMessage(
  message: string,
  signatureBase64: string,
  expectedCashaddr: string,
  prefix: CashAddressNetworkPrefix,
): { ok: true; publicKeyHex: string } | { ok: false; reason: string } {
  try {
    const publicKey = recoverMessagePublicKey(message, signatureBase64)
    const encoded = publicKeyToP2pkhCashAddress({ publicKey, prefix, throwErrors: false })
    if (typeof encoded === 'string') {
      return { ok: false, reason: encoded }
    }
    const cashaddr = encoded.address
    if (cashaddr !== expectedCashaddr) {
      return {
        ok: false,
        reason: `Signature recovers ${cashaddr}, not ${expectedCashaddr}.`,
      }
    }
    return { ok: true, publicKeyHex: binToHex(publicKey) }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
}
