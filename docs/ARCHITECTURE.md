# Architecture

Kola Link is a static web app. There is no application backend. The browser talks to public Nostr relays and, when the XO helper runs, to public chipnet Electrum servers.

```
Holder keys (NIP-07, nsec, or WizardConnect wallet)
        │
        ▼
 Canonical statement  ──►  Nostr kind 30078 event
        │                           │
        ▼                           ▼
 BCH signed message          Public relays
        │                           │
        └──────────► Verifier ◄─────┘
                     (pure functions)
```

## Roles

- **Holder** — controls a Nostr key and a Bitcoin Cash key, publishes the binding.
- **Verifier / relying app** — Sawa Market in the demo. Fetches an event, runs `verifyBindingEvent`, then a challenge-response login.
- **Issuer** — Kumba Verify in the demo. Publishes salted attribute commitments. Not an identity provider; it cannot move the holder's keys.

## Why the on-chain anchor is optional

A Bitcoin Signed Message already proves control of the cashaddr and does not require a fee or a faucet. The XO identity-anchor output adds a public, timestamped commitment and authorised rotate/revoke. That is a clear improvement when a network transaction is available, and it is the Build with XO demonstration. The DID bounty itself does not require a mainnet transaction.

## Trust boundaries

- Relays can censor, delay, or serve stale events. Verifiers should query more than one relay and treat the event signature, not the relay, as the source of truth.
- A signed message proves key control at a point in time; it does not by itself revoke a leaked key. Use a new binding event and, if present, `revoke` on the anchor UTXO.
- Demo nsec / WIF values stored in localStorage are for chipnet demonstrations only.
- WizardConnect never sees the Nostr secret, and the Nostr signer never sees the Bitcoin Cash secret.
