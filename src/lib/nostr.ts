import {
  type EventTemplate,
  type Event as NostrEvent,
  finalizeEvent,
  getEventHash,
  verifyEvent,
} from 'nostr-tools'
import { hexToBin } from '@bitauth/libauth'
import { SimplePool } from 'nostr-tools/pool'
import {
  ATTESTATION_D_PREFIX,
  ATTESTATION_KIND,
  AUTH_KIND,
  BINDING_D_TAG,
  BINDING_KIND,
  DEFAULT_RELAYS,
} from './constants.ts'
import type { IssuedAttestation } from './attestations.ts'
import { encodeStatement, type BindingStatement } from './statement.ts'

export type BchProof =
  | { type: 'bitcoin-message'; signature: string }
  | { type: 'anchor-txid'; txid: string; network: 'chipnet' | 'mainnet' }

export type BindingContent = {
  statement: string
  commitment: string
  proofs: BchProof[]
  /** Optional payment xpub or receive hint published by the holder. */
  paymentHint?: string
}

export function buildBindingTemplate(
  statement: BindingStatement,
  commitmentHex: string,
  proofs: BchProof[],
  paymentHint?: string,
): EventTemplate {
  const encoded = encodeStatement(statement)
  const proofRef = proofs[0]
    ? proofs[0].type === 'bitcoin-message'
      ? proofs[0].signature.slice(0, 24)
      : proofs[0].txid
    : ''
  const content: BindingContent = {
    statement: encoded,
    commitment: commitmentHex,
    proofs,
    paymentHint,
  }
  return {
    kind: BINDING_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', BINDING_D_TAG],
      ['i', `bch:${statement.cashaddr}`, proofRef],
      ['c', commitmentHex],
      ['client', 'kola-link'],
    ],
    content: JSON.stringify(content),
  }
}

export function signBindingEvent(
  template: EventTemplate,
  secretKeyHex: string,
): NostrEvent {
  return finalizeEvent(template, hexToBin(secretKeyHex))
}

export function parseBindingContent(event: NostrEvent): BindingContent {
  const parsed = JSON.parse(event.content) as BindingContent
  if (!parsed?.statement || !parsed?.commitment || !Array.isArray(parsed.proofs)) {
    throw new Error('Event content is not a Kola Link binding.')
  }
  return parsed
}

export function eventNpubHex(event: NostrEvent): string {
  return event.pubkey
}

export async function publishToRelays(
  event: NostrEvent,
  relays: readonly string[] = DEFAULT_RELAYS,
): Promise<{ relay: string; ok: boolean; error?: string }[]> {
  const pool = new SimplePool()
  try {
    const results = await Promise.allSettled(
      relays.map(async (relay) => {
        await pool.publish([relay], event)
        return relay
      }),
    )
    return results.map((result, index) => {
      const relay = relays[index]
      if (result.status === 'fulfilled') return { relay, ok: true }
      return { relay, ok: false, error: String(result.reason) }
    })
  } finally {
    pool.close([...relays])
  }
}

export async function lookupBindingByNpub(
  npubHex: string,
  relays: readonly string[] = DEFAULT_RELAYS,
): Promise<NostrEvent | null> {
  const pool = new SimplePool()
  try {
    const events = await pool.querySync([...relays], {
      kinds: [BINDING_KIND],
      authors: [npubHex],
      '#d': [BINDING_D_TAG],
      limit: 5,
    })
    const verified = events.filter((event) => verifyEvent(event))
    verified.sort((a, b) => b.created_at - a.created_at)
    return verified[0] ?? null
  } finally {
    pool.close([...relays])
  }
}

export async function lookupBindingByCashaddr(
  cashaddr: string,
  relays: readonly string[] = DEFAULT_RELAYS,
): Promise<NostrEvent | null> {
  const pool = new SimplePool()
  try {
    const events = await pool.querySync([...relays], {
      kinds: [BINDING_KIND],
      '#i': [`bch:${cashaddr}`],
      limit: 5,
    })
    const verified = events
      .filter((event) => verifyEvent(event))
      .filter((event) => event.tags.some((tag) => tag[0] === 'd' && tag[1] === BINDING_D_TAG))
    verified.sort((a, b) => b.created_at - a.created_at)
    return verified[0] ?? null
  } finally {
    pool.close([...relays])
  }
}

export function buildAuthTemplate(app: string, origin: string, nonce: string, expires: number): EventTemplate {
  return {
    kind: AUTH_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['u', origin],
      ['method', 'LOGIN'],
      ['payload', JSON.stringify({ app, nonce, exp: expires })],
      ['client', 'kola-link'],
    ],
    content: `kola-auth:v1|app=${app}|origin=${origin}|nonce=${nonce}|exp=${expires}`,
  }
}

export function signAuthEvent(template: EventTemplate, secretKeyHex: string): NostrEvent {
  return finalizeEvent(template, hexToBin(secretKeyHex))
}

export function verifyAuthEvent(
  event: NostrEvent,
  expected: { app: string; origin: string; nonce: string; expires: number; npubHex: string },
): { ok: true } | { ok: false; reason: string } {
  if (!verifyEvent(event)) return { ok: false, reason: 'Nostr signature is invalid.' }
  if (event.kind !== AUTH_KIND) return { ok: false, reason: 'Unexpected event kind.' }
  if (event.pubkey !== expected.npubHex) return { ok: false, reason: 'Signed by a different npub.' }
  if (Date.now() / 1000 > expected.expires) return { ok: false, reason: 'Challenge has expired.' }
  if (!event.content.includes(`nonce=${expected.nonce}`)) {
    return { ok: false, reason: 'Nonce does not match the challenge.' }
  }
  if (!event.content.includes(`app=${expected.app}`)) {
    return { ok: false, reason: 'App id does not match the challenge.' }
  }
  return { ok: true }
}

export function buildAttestationTemplate(
  attestation: IssuedAttestation,
  subjectNpub: string,
): EventTemplate {
  return {
    kind: ATTESTATION_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', `${ATTESTATION_D_PREFIX}${subjectNpub}`],
      ['p', subjectNpub],
      ['client', 'kola-link-kumba'],
    ],
    content: JSON.stringify(attestation),
  }
}

export function signAttestationEvent(template: EventTemplate, secretKeyHex: string): NostrEvent {
  return finalizeEvent(template, hexToBin(secretKeyHex))
}

export function eventIdOf(event: NostrEvent): string {
  return event.id ?? getEventHash(event)
}

export { verifyEvent, type NostrEvent, type EventTemplate }
