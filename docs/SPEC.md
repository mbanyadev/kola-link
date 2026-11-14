# KL-1 — Kola Link binding specification

Kola Link is a self-sovereign way to bind a Bitcoin Cash wallet identity to a Nostr public key. A third party can discover and verify the binding without contacting a Kola Link server.

## 1. Canonical statement

A binding statement is a single UTF-8 string:

```
kola-link:v1|npub=<32-byte-hex>|bch=<cashaddr>|created=<unix-seconds>|nonce=<16+ hex>
```

Fields are ordered and cannot be reordered. `npub` is the 32-byte Nostr public key in lowercase hex, not bech32. `bch` is a cashaddr including its prefix (`bitcoincash:` or `bchtest:`). `nonce` is at least 8 random bytes, hex-encoded.

The **commitment** is `SHA-256(utf8(statement))`, 32 bytes.

## 2. Proofs of control

The two keys must be independent. Reusing one private key on both sides is not a valid binding.

### Nostr

The holder signs a parameterized replaceable event (NIP-78 / kind `30078`) with `d=kola-link`.

Recommended tags:

- `["d", "kola-link"]`
- `["i", "bch:<cashaddr>", "<proof-ref>"]` (NIP-39-style external identity)
- `["c", "<commitment-hex>"]`

The event content is JSON:

```json
{
  "statement": "kola-link:v1|…",
  "commitment": "<32-byte hex>",
  "proofs": [
    { "type": "bitcoin-message", "signature": "<base64>" },
    { "type": "anchor-txid", "txid": "<64-hex>", "network": "chipnet" }
  ]
}
```

A valid Nostr signature over this event is proof of control of `npub`.

### Bitcoin Cash

At least one of the following proves control of `bch`:

1. **Bitcoin Signed Message** of the exact statement string, using the compressed-pubkey variant (header 31–34). Recovering the key must yield the same P2PKH cashaddr.
2. **On-chain identity anchor** (optional, stronger timestamp): a chipnet or mainnet transaction whose output (or OP_RETURN) commits to the 32-byte commitment and is spendable only by the bound key. The XO `identity-anchor` template implements this as a P2SH redeem script:

   ```
   <commitment> OP_DROP OP_DUP OP_HASH160 <hash160(holder pubkey)> OP_EQUALVERIFY OP_CHECKSIG
   ```

   Follow-up actions: `rotate` (spend to a new commitment) and `revoke` (spend back to plain P2PKH).

Simply listing a cashaddr in a Nostr profile is not sufficient.

## 3. Discovery

Publish the kind-30078 event to several independent public relays. Third parties:

- look up by author and `#d=kola-link`, or
- look up by `#i=bch:<cashaddr>`.

No proprietary database is required. Relays are a transport, not an authority.

## 4. Verification

A verifier, given an event, MUST:

1. Check the Nostr Schnorr signature (`verifyEvent`).
2. Parse the statement and require `npub` to equal `event.pubkey`.
3. Recompute `SHA-256(statement)` and require it to equal the published commitment.
4. Validate the cashaddr.
5. Check at least one Bitcoin Cash proof as defined above.

The TypeScript functions in `src/lib/verify.ts`, `src/lib/statement.ts` and `src/lib/bch-message.ts` implement this and can be reused by other apps.

## 5. Authentication

A relying app issues a short-lived challenge:

```
kola-auth:v1|app=<id>|origin=<origin>|nonce=<hex>|exp=<unix>
```

The holder signs a NIP-98-style event (kind `27235`) whose content includes that string. The app checks the signature, expiry, nonce, and that the pubkey has a verified KL-1 binding.

## 6. Optional extensions

- **Identity payments:** resolve a verified binding and pay the cashaddr (or a published payment hint) without asking the recipient to paste an address.
- **Selective-disclosure attestations:** an issuer publishes salted SHA-256 commitments of attributes (`salt|name|value`). The holder discloses one attribute plus the salt; the verifier recomputes the hash. Other attributes remain hidden.
- **Key rotation:** publish a new binding event and, if an anchor UTXO exists, spend it with `rotate`.
