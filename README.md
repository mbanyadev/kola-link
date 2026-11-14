# Kola Link

Self-sovereign **Bitcoin Cash ⇄ Nostr** identity. A holder binds a wallet they control to a Nostr key they control. Any app can discover that link on public relays and verify it with no Kola Link server.

Built by Mbanya Dev for [BCH BLAZE 2026](https://bchblaze.cash/), targeting the Paytaca **Decentralized Identity** bounty and the General Protocols **Build with XO** bounty. The live demo defaults to **chipnet**.

- Live demo: https://mbanyadev.github.io/kola-link/
- Presentation: https://mbanyadev.github.io/kola-link/presentation/
- Specification: [docs/SPEC.md](docs/SPEC.md) (KL-1)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- XO template and reproduction: [xo/REPRODUCE.md](xo/REPRODUCE.md)

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
