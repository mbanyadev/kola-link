import type { BchNetwork } from './constants.ts'
import type { BchKeypair, NostrKeypair } from './keys.ts'

const PREFIX = 'kola-link:'

export function loadNetwork(): BchNetwork {
  return localStorage.getItem(`${PREFIX}network`) === 'mainnet' ? 'mainnet' : 'chipnet'
}

export function saveNetwork(network: BchNetwork): void {
  localStorage.setItem(`${PREFIX}network`, network)
}

export function loadNostr(): NostrKeypair | null {
  const raw = localStorage.getItem(`${PREFIX}nostr`)
  return raw ? (JSON.parse(raw) as NostrKeypair) : null
}

export function saveNostr(keys: NostrKeypair | null): void {
  if (!keys) localStorage.removeItem(`${PREFIX}nostr`)
  else localStorage.setItem(`${PREFIX}nostr`, JSON.stringify(keys))
}

export function loadBch(): BchKeypair | null {
  const raw = localStorage.getItem(`${PREFIX}bch`)
  return raw ? (JSON.parse(raw) as BchKeypair) : null
}

export function saveBch(keys: BchKeypair | null): void {
  if (!keys) localStorage.removeItem(`${PREFIX}bch`)
  else localStorage.setItem(`${PREFIX}bch`, JSON.stringify(keys))
}
