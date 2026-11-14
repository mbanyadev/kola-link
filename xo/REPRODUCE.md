# Reproduce the XO identity-anchor invitation

This is the Build with XO reproduction guide. The official debug tool is https://blaze.xo.cash/. Work on **chipnet** only unless you are deliberately using mainnet funds.

## Chipnet run (14 Nov 2026)

Executed on 14 Nov 2026 with a throwaway chipnet account, funded from a free chipnet faucet.

- Template id: `719cabf1d86ee1c3ea3cd7c98b09f7638823fe1074cca8b1ca95e55a5c59464c`
- Bind invitation id: `b29c77431113a7898bf6dc151c8916eb`
- Bind transaction (10,000 sat P2SH anchor): https://chipnet.imaginary.cash/tx/e13cb5da54ef8e2449ae4b497afb96f6ea80a14f96d3fdbc4ed1eed5a7a1638c
- Revoke transaction: https://chipnet.imaginary.cash/tx/903ce89337bb5452d25206a6fa1cfb08e3d11a74b92ccd2dffb5eeec385c6aa0
- Invitation to load in the debug tool: [`xo/last-invitation.json`](./last-invitation.json)
- Run log (no keys or seeds): [`xo/chipnet-run-log.txt`](./chipnet-run-log.txt)

The bind helper used a 1,000-satoshi miner fee and an explicit 10,000-satoshi anchor output. The invitation above is the one that produced the bind transaction.

## What we ship

- Template source: [`identity-anchor.ts`](./identity-anchor.ts)
- Serialized template: [`identity-anchor.template.json`](./identity-anchor.template.json)
- Template identifier: `719cabf1d86ee1c3ea3cd7c98b09f7638823fe1074cca8b1ca95e55a5c59464c`
- Actions: `bind` (start), `rotate` and `revoke` (follow-ups on the anchor output)

## Prerequisites

- Node 22+
- Chipnet test satoshis from https://chipnet.bch.ninja/ or https://tbch.googol.cash/
- `@xo-cash/engine@0.1.1-next.17778370827` (already in this repo's dependencies)

## Steps

1. Install and export the template (optional; the JSON is already committed):

   ```bash
   npm install
   npm run xo:export
   ```

2. Run the bind helper. It creates a chipnet account, prints a receive address, and waits until that address is funded:

   ```bash
   npm run xo:bind
   ```

3. Send a modest amount of chipnet BCH (for example 0.001 tBCH) to the printed address. Keep it well above the 546-satoshi dust limit plus the 1,000-satoshi miner fee and the 10,000-satoshi preferred anchor.

4. The script then:

   - creates a `bind` invitation with a demo 32-byte commitment, generating `holderKey` on the invitation
   - adds the funded output as an input
   - appends an explicit 10,000-satoshi (or remaining-minus-fee) anchor output and change, leaving a 1,000-satoshi fee
   - signs and broadcasts with `executeAction({ broadcastTransaction: true })`
   - waits for the anchor output, then signs and broadcasts a `revoke` of that output
   - writes `xo/last-invitation.json` (the bind invitation you should load in the debug tool)
   - writes `xo/last-run.json` with the transaction hashes and receive address

5. Open https://blaze.xo.cash/, import `xo/identity-anchor.template.json` and `xo/last-invitation.json`, and inspect the invitation / transaction.

6. Optional follow-up, once a bind output is confirmed and not yet revoked: create a `rotate` invitation against that output, using the same account. `rotate` requires a `newCommitment` variable.

## Invitation file

The invitation from the 14 Nov 2026 chipnet run lives at:

- `xo/last-invitation.json`
