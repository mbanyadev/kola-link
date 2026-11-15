The getting-started guide is clear right up to the point where you try to broadcast something.

I wrote an identity-anchor template for Kola Link with three actions: bind, rotate and revoke. It is a P2SH output that commits to the sha256 of a binding statement and still needs the holder's signature to move. Working from the docs and the official p2pkh, faucet and wrapBCH examples, I wrote the template itself in about half an hour.

parseTemplate was a real help. Its first error was precise: follow-up variables must be an array of records, such as [{ newCommitment: null }], not the string array the blog shows. That took a few minutes to fix. The template identifier is 719cabf1d86ee1c3ea3cd7c98b09f7638823fe1074cca8b1ca95e55a5c59464c, and serializeTemplate handled the BigInt constants cleanly as Extended JSON.

Running it was harder.

My usual machine cannot reach chipnet Electrum. Ports 50002 and 50004 appear open, but TLS fails against a 198.18.0.1 intercept and the WebSocket returns 1006. Engine.create will not return without a header accumulator, and there is no documented offline mode. Mainnet has a port 443 WSS fallback for restricted networks, but chipnet does not, so I had to move the run to a machine with a normal route to Electrum.

I funded it from a free chipnet faucet. The helper waits for a UTXO, and mine arrived in about a minute. When I checked faucets at the end of October, tbch.googol.cash was unreachable and the Paytaca faucet looked gated, so I would not rely on either.

With the engine running, I hit three problems in the helper path that getting-started does not mention.

First, Engine.create({ databasePath }) uses better-sqlite3, which does not create missing parent directories. If xo/.xo-engine/ does not already exist, the engine fails when it opens the database. I had to run mkdirSync recursively first.

Second, listTemplateActionIntents() is not enough to start bind, because it returns only { action }. The engine records a private key on the invitation only from intent.generate or role.generate, and the locking script will not compile without holderKey. So passing the listed intent straight through, as the docs suggest, fails at compile time. I had to pass { action: 'bind', role: 'holder', generate: ['holderKey'] } explicitly.

Third, the engine does not add the template's anchorOutput by itself. calculateChange and addChangeToInvitation then treat the whole funded input as leftover, and the broadcast is rejected with "min relay fee not met". I had to call appendInvitation with an explicit 10,000-satoshi anchor, or input minus fee if the deposit was smaller, and then add change after a 1,000-satoshi miner fee. revoke needed the same treatment.

With those three fixes in place, executeAction broadcast both the bind and the revoke on chipnet on 14 Nov 2026. Bind: https://chipnet.imaginary.cash/tx/e13cb5da54ef8e2449ae4b497afb96f6ea80a14f96d3fdbc4ed1eed5a7a1638c. Revoke: https://chipnet.imaginary.cash/tx/903ce89337bb5452d25206a6fa1cfb08e3d11a74b92ccd2dffb5eeec385c6aa0. The invitation loads in https://blaze.xo.cash/.

A few smaller points:

- Getting-started still pins engine 0.1.0-next, but npm next is already on 0.1.1-next. I used 0.1.1-next.17778370827, and it installed cleanly, better-sqlite3 included.
- The official template sources returned 404 on GitLab, so I unpacked the npm tarball instead.
- executeAction takes two arguments, not one options object.
- calculateChange returns valueSatoshis, not satoshis.

The official examples were enough to copy the shape from, and once you have a working network, the documented path makes sense. What I needed was that last mile written down.
