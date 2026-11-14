import { describe, expect, it } from 'vitest'
import { generateBchKeypair, generateNostrKeypair } from './keys.ts'
import {
  encodeStatement,
  parseStatement,
  randomNonce,
  statementCommitmentHex,
} from './statement.ts'
import { signBitcoinMessage, verifyBitcoinMessage } from './bch-message.ts'
import { hexToBin } from '@bitauth/libauth'
import { prefixFor } from './keys.ts'
import {
  buildBindingTemplate,
  signBindingEvent,
} from './nostr.ts'
import { verifyBindingEvent } from './verify.ts'
import { saltAttribute, verifyDisclosure } from './attestations.ts'
import { buildAuthTemplate, signAuthEvent, verifyAuthEvent } from './nostr.ts'

describe('binding statement', () => {
  it('round-trips a canonical statement and commitment', () => {
    const nostr = generateNostrKeypair()
    const bch = generateBchKeypair('chipnet')
    const encoded = encodeStatement({
      version: 'kola-link:v1',
      npubHex: nostr.publicKeyHex,
      cashaddr: bch.cashaddr,
      created: 1_700_000_000,
      nonce: randomNonce(),
    })
    const parsed = parseStatement(encoded)
    expect(parsed.npubHex).toBe(nostr.publicKeyHex)
    expect(parsed.cashaddr).toBe(bch.cashaddr)
    expect(statementCommitmentHex(encoded)).toMatch(/^[0-9a-f]{64}$/)
    expect(() => parseStatement('not-a-statement')).toThrow()
  })
})

describe('bch message proof', () => {
  it('signs and recovers the same chipnet cashaddr', () => {
    const bch = generateBchKeypair('chipnet')
    const message = 'kola-link:v1|npub=ab|bch=test'
    const signature = signBitcoinMessage(message, hexToBin(bch.privateKeyHex))
    const checked = verifyBitcoinMessage(
      message,
      signature,
      bch.cashaddr,
      prefixFor('chipnet'),
    )
    expect(checked.ok).toBe(true)
  })
})

describe('full binding event', () => {
  it('verifies a signed Nostr event plus a BCH message proof', () => {
    const nostr = generateNostrKeypair()
    const bch = generateBchKeypair('chipnet')
    const statement = {
      version: 'kola-link:v1' as const,
      npubHex: nostr.publicKeyHex,
      cashaddr: bch.cashaddr,
      created: 1_700_000_000,
      nonce: 'aabbccddeeff0011',
    }
    const encoded = encodeStatement(statement)
    const commitment = statementCommitmentHex(encoded)
    const signature = signBitcoinMessage(encoded, hexToBin(bch.privateKeyHex))
    const template = buildBindingTemplate(statement, commitment, [
      { type: 'bitcoin-message', signature },
    ])
    const event = signBindingEvent(template, nostr.secretKeyHex)
    const verified = verifyBindingEvent(event, 'chipnet')
    expect(verified.ok).toBe(true)
    if (verified.ok) {
      expect(verified.npubHex).toBe(nostr.publicKeyHex)
      expect(verified.cashaddr).toBe(bch.cashaddr)
    }
  })
})

describe('selective disclosure', () => {
  it('accepts a matching salt and rejects a wrong value', () => {
    const salt = 'aa'.repeat(16)
    const commitments = {
      over18: saltAttribute(salt, 'over18', 'true'),
      country: saltAttribute(salt, 'country', 'CM'),
    }
    const attestation = {
      issuerNpub: '11'.repeat(32),
      subjectNpub: '22'.repeat(32),
      commitments,
      issuedAt: 1,
    }
    expect(
      verifyDisclosure(attestation, { attribute: 'over18', value: 'true', salt }).ok,
    ).toBe(true)
    expect(
      verifyDisclosure(attestation, { attribute: 'over18', value: 'false', salt }).ok,
    ).toBe(false)
  })
})

describe('sawa auth challenge', () => {
  it('accepts a matching signed challenge and rejects a wrong nonce', () => {
    const nostr = generateNostrKeypair()
    const expires = Math.floor(Date.now() / 1000) + 300
    const template = buildAuthTemplate('sawa.market', 'https://sawa.example', 'deadbeef', expires)
    const event = signAuthEvent(template, nostr.secretKeyHex)
    const ok = verifyAuthEvent(event, {
      app: 'sawa.market',
      origin: 'https://sawa.example',
      nonce: 'deadbeef',
      expires,
      npubHex: nostr.publicKeyHex,
    })
    expect(ok.ok).toBe(true)
    const bad = verifyAuthEvent(event, {
      app: 'sawa.market',
      origin: 'https://sawa.example',
      nonce: 'cafebabe',
      expires,
      npubHex: nostr.publicKeyHex,
    })
    expect(bad.ok).toBe(false)
  })
})
