import { cashAddressToLockingBytecode, hexToBin } from '@bitauth/libauth'
import type { Event as NostrEvent } from 'nostr-tools'
import { verifyEvent } from 'nostr-tools'
import { verifyBitcoinMessage } from './bch-message.ts'
import { prefixFor } from './keys.ts'
import type { BchNetwork } from './constants.ts'
import { parseBindingContent, type BchProof } from './nostr.ts'
import { parseStatement, statementCommitmentHex } from './statement.ts'

export type BindingVerification =
  | {
      ok: true
      npubHex: string
      cashaddr: string
      commitment: string
      statement: string
      proofs: BchProof[]
    }
  | { ok: false; reason: string }

/**
 * Verify a published Kola Link binding event:
 * 1. The Nostr signature is valid (proof of npub control).
 * 2. The canonical statement commits to that npub and cashaddr.
 * 3. sha256(statement) matches the published commitment.
 * 4. At least one BCH proof shows control of the cashaddr
 *    (signed message today; optional on-chain anchor checked separately).
 */
export function verifyBindingEvent(
  event: NostrEvent,
  network: BchNetwork,
): BindingVerification {
  if (!verifyEvent(event)) return { ok: false, reason: 'Nostr signature is invalid.' }
  try {
    const content = parseBindingContent(event)
    const statement = parseStatement(content.statement)
    if (statement.npubHex !== event.pubkey) {
      return { ok: false, reason: 'Statement npub does not match the event pubkey.' }
    }
    const expectedCommitment = statementCommitmentHex(content.statement)
    if (content.commitment !== expectedCommitment) {
      return { ok: false, reason: 'Published commitment does not match sha256(statement).' }
    }
    const decoded = cashAddressToLockingBytecode(statement.cashaddr)
    if (typeof decoded === 'string') {
      return { ok: false, reason: `Cashaddr is invalid: ${decoded}` }
    }
    if (content.proofs.length === 0) {
      return { ok: false, reason: 'No BCH proof of control was published.' }
    }
    const messageProofs = content.proofs.filter((proof) => proof.type === 'bitcoin-message')
    if (messageProofs.length === 0) {
      // Anchor-only bindings are acceptable if an on-chain check is supplied by the caller.
      const hasAnchor = content.proofs.some((proof) => proof.type === 'anchor-txid')
      if (!hasAnchor) return { ok: false, reason: 'No usable BCH proof was published.' }
    }
    for (const proof of messageProofs) {
      const checked = verifyBitcoinMessage(
        content.statement,
        proof.signature,
        statement.cashaddr,
        prefixFor(network),
      )
      if (!checked.ok) return { ok: false, reason: checked.reason }
    }
    return {
      ok: true,
      npubHex: event.pubkey,
      cashaddr: statement.cashaddr,
      commitment: content.commitment,
      statement: content.statement,
      proofs: content.proofs,
    }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
}

export function hexToBytes(hex: string): Uint8Array {
  return hexToBin(hex)
}
