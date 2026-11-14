# Kola Link

Self-sovereign **Bitcoin Cash ⇄ Nostr** identity. A holder binds a wallet they control to a Nostr key they control. Any app can discover that link on public relays and verify it with no Kola Link server.

Built by Mbanya Dev for [BCH BLAZE 2026](https://bchblaze.cash/), targeting the Paytaca **Decentralized Identity** bounty and the General Protocols **Build with XO** bounty. The live demo defaults to **chipnet**.

- Live demo: https://mbanyadev.github.io/kola-link/
- Presentation: https://mbanyadev.github.io/kola-link/presentation/
- Specification: [docs/SPEC.md](docs/SPEC.md) (KL-1)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- XO template and reproduction: [xo/REPRODUCE.md](xo/REPRODUCE.md)

## XO chipnet proof (14 Nov 2026)

The identity-anchor template was executed on chipnet on 14 Nov 2026, funded from a free chipnet faucet.

- Template id: `719cabf1d86ee1c3ea3cd7c98b09f7638823fe1074cca8b1ca95e55a5c59464c`
- Bind invitation id: `b29c77431113a7898bf6dc151c8916eb`
- Bind transaction (10,000 sat P2SH anchor): https://chipnet.imaginary.cash/tx/e13cb5da54ef8e2449ae4b497afb96f6ea80a14f96d3fdbc4ed1eed5a7a1638c
- Revoke transaction: https://chipnet.imaginary.cash/tx/903ce89337bb5452d25206a6fa1cfb08e3d11a74b92ccd2dffb5eeec385c6aa0
- Invitation: [xo/last-invitation.json](xo/last-invitation.json)


## Try the demo

1. Open the live demo (or `npm install && npm run dev`).
2. Stay on chipnet unless you know you want mainnet.
3. Generate a demo Nostr key and a demo Bitcoin Cash key, or use a NIP-07 extension and WizardConnect (Paytaca / Selene / Cashonize).
4. Sign and publish the binding. The app verifies it locally, then sends the event to `relay.damus.io`, `nos.lol`, and `relay.primal.net`.
5. Look the binding up by npub or cashaddr, then sign in to the Sawa Market demo.
6. Optional: resolve a payment address by identity, or issue a Kumba Verify attestation and disclose a single attribute.

## Develop

```bash
npm install
npm test
npm run dev
npm run build
```

The production site is a static Vite app hosted on GitHub Pages at `/kola-link/`.

```bash
npm run xo:export   # validate and rewrite xo/identity-anchor.template.json
npm run xo:bind     # fund-and-bind helper for chipnet (see xo/REPRODUCE.md)
```

## What this is not

It is not a custodian, not a hosted identity provider, and not an offer of securities. Community Choice CashTokens voting needs a real token-aware address in the top-of-page banner; the checked-in banner still has a clearly marked placeholder.
