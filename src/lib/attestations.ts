import { binToHex, sha256, utf8ToBin } from '@bitauth/libauth'

export type AttestationAttribute = 'over18' | 'country' | 'merchant'

export const ATTRIBUTE_LABELS: Record<AttestationAttribute, string> = {
  over18: 'Over 18',
  country: 'Country',
  merchant: 'Verified merchant',
}

export function saltAttribute(salt: string, name: AttestationAttribute, value: string): string {
  return binToHex(sha256.hash(utf8ToBin(`${salt}|${name}|${value}`)))
}

export function randomSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return binToHex(bytes)
}

export type IssuedAttestation = {
  issuerNpub: string
  subjectNpub: string
  commitments: Partial<Record<AttestationAttribute, string>>
  issuedAt: number
}

export type Disclosure = {
  attribute: AttestationAttribute
  value: string
  salt: string
}

export function verifyDisclosure(
  attestation: IssuedAttestation,
  disclosure: Disclosure,
): { ok: true } | { ok: false; reason: string } {
  const expected = attestation.commitments[disclosure.attribute]
  if (!expected) {
    return { ok: false, reason: `Issuer did not attest ${disclosure.attribute}.` }
  }
  const actual = saltAttribute(disclosure.salt, disclosure.attribute, disclosure.value)
  if (actual !== expected) {
    return { ok: false, reason: 'Salted hash does not match the issuer commitment.' }
  }
  return { ok: true }
}
