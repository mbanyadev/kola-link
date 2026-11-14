# Reproduce the XO identity-anchor invitation

This is the Build with XO reproduction guide. The official debug tool is https://blaze.xo.cash/. Work on **chipnet** only unless you are deliberately using mainnet funds.

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

3. Send a modest amount of chipnet BCH (for example 0.001 tBCH) to the printed address. Keep it well above the 546-satoshi dust limit plus the 400-satoshi fee constant.

4. The script then:

   - creates a `bind` invitation with a demo 32-byte commitment
   - adds the funded output as an input
   - adds change
   - signs and broadcasts with `executeAction({ broadcastTransaction: true })`
   - writes `xo/last-invitation.json` (the invitation you should load in the debug tool)
   - writes `xo/last-run.json` with the transaction hash and receive address

5. Open https://blaze.xo.cash/, import `xo/identity-anchor.template.json` and `xo/last-invitation.json`, and inspect the invitation / transaction.

6. Optional follow-ups, once the bind output is confirmed: create a `rotate` or `revoke` invitation against that output, using the same account. `rotate` requires a `newCommitment` variable.

## Invitation file

After a successful run, the invitation used to execute the transaction lives at:

- `xo/last-invitation.json`

If that file is not present, the chipnet transaction has not been executed in this checkout yet.
