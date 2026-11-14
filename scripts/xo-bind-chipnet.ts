import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertSuccess,
  CashAddressNetworkPrefix,
  generateBip39Mnemonic,
  binToHex,
  hexToBin,
  lockingBytecodeToCashAddress,
} from '@bitauth/libauth'
import { Engine, XO_SUPPORTED_NETWORKS, listTemplateActionIntents } from '@xo-cash/engine'
import { serializeInvitation, serializeTemplate } from '@xo-cash/utils'
import { identityAnchorTemplate } from '../xo/identity-anchor.ts'
import { randomNonce, statementCommitmentHex } from '../src/lib/statement.ts'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../xo')

function log(message: string) {
  const now = new Date().toLocaleString('en-GB', { timeZone: 'Africa/Douala' })
  console.log(`[${now} WAT] ${message}`)
}

function outpointHash(value: string | Uint8Array) {
  return typeof value === 'string' ? value : binToHex(value)
}

async function waitForTaggedOutput(
  engine: Engine,
  templateIdentifier: string,
  transactionHash: string | undefined,
  valueSatoshis: bigint,
  timeoutMs = 90_000,
) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const outputs = await engine.listSpendableUnspentOutputs({ templateIdentifier })
    const match = outputs.find((output) => {
      const hash = outpointHash(output.outpointTransactionHash)
      return hash === transactionHash && BigInt(output.valueSatoshis) === valueSatoshis
    })
    if (match) return match
    await new Promise((resolveWait) => setTimeout(resolveWait, 4000))
    log('Still waiting for the anchor output…')
  }
  return undefined
}

async function waitForOutput(engine: Engine, templateIdentifier: string, timeoutMs = 15 * 60 * 1000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const outputs = await engine.listSpendableUnspentOutputs({ templateIdentifier })
    if (outputs.length > 0) return outputs
    await new Promise((resolveWait) => setTimeout(resolveWait, 8000))
    log('Still waiting for a chipnet UTXO…')
  }
  throw new Error('Timed out waiting for a chipnet deposit.')
}

async function main() {
  mkdirSync(outDir, { recursive: true })
  const mnemonic = generateBip39Mnemonic()
  log('Created a throwaway chipnet mnemonic (not printed). Opening the XO engine…')

  // better-sqlite3 does not create missing parent directories.
  const databasePath = resolve(outDir, '.xo-engine')
  mkdirSync(databasePath, { recursive: true })

  const engine = await Engine.create(mnemonic, {
    network: XO_SUPPORTED_NETWORKS.chipnet,
    databasePath,
    databaseFilename: 'kola-link-chipnet',
    electrumApplicationIdentifier: 'kola-link',
  })

  try {
    const { templateIdentifier } = await engine.importTemplate(identityAnchorTemplate as never)
    await engine.setDefaultPolicies({
      change: { templateIdentifier },
      receive: { templateIdentifier },
      address: { templateIdentifier },
    })
    log(`Imported identity-anchor template ${templateIdentifier}`)

    const receiveBytecodeHex = await engine.generateLockingBytecodeFromDefaultPolicy('receive')
    const address = assertSuccess(
      lockingBytecodeToCashAddress({
        prefix: CashAddressNetworkPrefix.testnet,
        bytecode: hexToBin(receiveBytecodeHex),
      }),
    ).address
    log(`Send chipnet BCH to ${address}`)
    log('Faucet: https://chipnet.bch.ninja/  (or https://tbch.googol.cash/)')
    writeFileSync(
      resolve(outDir, 'last-receive-address.txt'),
      `${address}\n`,
    )

    const funded = await waitForOutput(engine, templateIdentifier)
    const fundedOutput = funded[0]
    log(`Funded. Using outpoint ${fundedOutput.outpointTransactionHash}:${fundedOutput.outpointIndex}`)

    const intents = listTemplateActionIntents(identityAnchorTemplate as never)
    // listTemplateActionIntents() returns { action } only. The engine records a
    // private key on the invitation solely from intent.generate / role.generate,
    // and the identity-anchor locking script refuses to compile without that
    // holderKey. The template start entry is the intent that asks for it.
    const bindIntent = {
      action: 'bind' as const,
      role: 'holder' as const,
      generate: ['holderKey' as const],
    }

    const commitment = statementCommitmentHex(
      `kola-link:v1|npub=${'ab'.repeat(32)}|bch=${address}|created=${Math.floor(Date.now() / 1000)}|nonce=${randomNonce()}`,
    )
    // The engine does not materialize template transaction outputs on its own.
    // Without an explicit anchor output, change math treats the whole input as
    // leftover and the broadcast is rejected with "min relay fee not met".
    const minerFeeSatoshis = 1_000n
    const dustSatoshis = 546n
    const inputValue = BigInt(fundedOutput.valueSatoshis)
    if (inputValue <= minerFeeSatoshis + dustSatoshis) {
      throw new Error(`Funded output of ${inputValue} satoshis cannot cover an anchor and a relay fee.`)
    }
    const preferredAnchor = 10_000n
    const anchorSatoshis =
      inputValue >= preferredAnchor + minerFeeSatoshis ? preferredAnchor : inputValue - minerFeeSatoshis

    const created = await engine.createInvitation({
      templateIdentifier,
      actionIdentifier: 'bind',
      intent: bindIntent,
      variables: [
        { variableIdentifier: 'commitment', roleIdentifier: 'holder', value: commitment },
        { variableIdentifier: 'anchorSatoshis', roleIdentifier: 'holder', value: anchorSatoshis },
      ],
      inputs: [
        {
          outpointTransactionHash:
            typeof fundedOutput.outpointTransactionHash === 'string'
              ? hexToBin(fundedOutput.outpointTransactionHash)
              : fundedOutput.outpointTransactionHash,
          outpointIndex: fundedOutput.outpointIndex,
        },
      ],
    })
    const { invitationIdentifier } = created.invitation
    log(`Created bind invitation ${invitationIdentifier}`)

    await engine.appendInvitation(invitationIdentifier, {
      templateIdentifier,
      actionIdentifier: 'bind',
      outputs: [{ outputIdentifier: 'anchorOutput', valueSatoshis: anchorSatoshis }],
    })
    log(`Added anchor output of ${anchorSatoshis} satoshis`)

    const changeValue = inputValue - anchorSatoshis - minerFeeSatoshis
    if (changeValue >= dustSatoshis) {
      const changeBytecode = await engine.generateLockingBytecodeFromDefaultPolicy(
        'change',
        undefined,
        invitationIdentifier,
      )
      await engine.appendInvitation(invitationIdentifier, {
        templateIdentifier,
        actionIdentifier: 'bind',
        outputs: [{ lockingBytecode: hexToBin(changeBytecode), valueSatoshis: changeValue }],
      })
      log(`Added change of ${changeValue} satoshis, leaving a ${minerFeeSatoshis}-satoshi fee`)
    } else {
      log(`No change output. The ${minerFeeSatoshis}-satoshi remainder is the miner fee.`)
    }

    const ownInputs = await engine.listOwnInputIndexes(invitationIdentifier)
    for (const inputIndex of ownInputs) {
      await engine.signInvitation(invitationIdentifier, inputIndex)
      log(`Signed input ${inputIndex}`)
    }

    const executed = await engine.executeAction(invitationIdentifier, {
      broadcastTransaction: true,
    })
    const bindTxid = executed.builtTransaction?.transactionHash
    log(`Bind broadcast ${bindTxid} (${executed.builtTransaction?.transactionByteLength} bytes)`)
    log(`https://chipnet.imaginary.cash/tx/${bindTxid}`)

    let revokeTxid: string | undefined
    try {
      const anchorOutput = await waitForTaggedOutput(engine, templateIdentifier, bindTxid, anchorSatoshis)
      const revokeIntent = intents.find((intent) => intent.action === 'revoke')
      if (!anchorOutput || !revokeIntent) throw new Error('Anchor output or revoke intent was not available.')
      const revokeOutpoint =
        typeof anchorOutput.outpointTransactionHash === 'string'
          ? anchorOutput.outpointTransactionHash
          : binToHex(anchorOutput.outpointTransactionHash)
      log(`Revoking anchor ${revokeOutpoint}:${anchorOutput.outpointIndex}`)
      const revokeCreated = await engine.createInvitation({
        templateIdentifier,
        actionIdentifier: 'revoke',
        intent: revokeIntent,
        variables: [
          { variableIdentifier: 'commitment', roleIdentifier: 'holder', value: commitment },
          { variableIdentifier: 'anchorSatoshis', roleIdentifier: 'holder', value: anchorSatoshis },
        ],
        inputs: [
          {
            inputIdentifier: 'anchorInput',
            outpointTransactionHash: hexToBin(revokeOutpoint),
            outpointIndex: anchorOutput.outpointIndex,
          },
        ],
      })
      const revokeInvitationIdentifier = revokeCreated.invitation.invitationIdentifier
      const revokeValue = anchorSatoshis - minerFeeSatoshis
      await engine.appendInvitation(revokeInvitationIdentifier, {
        templateIdentifier,
        actionIdentifier: 'revoke',
        outputs: [{ outputIdentifier: 'revokeOutput', valueSatoshis: revokeValue }],
      })
      const revokeInputs = await engine.listOwnInputIndexes(revokeInvitationIdentifier)
      for (const inputIndex of revokeInputs) {
        await engine.signInvitation(revokeInvitationIdentifier, inputIndex)
        log(`Signed revoke input ${inputIndex}`)
      }
      const revoked = await engine.executeAction(revokeInvitationIdentifier, { broadcastTransaction: true })
      revokeTxid = revoked.builtTransaction?.transactionHash
      log(`Revoke broadcast ${revokeTxid} (${revoked.builtTransaction?.transactionByteLength} bytes)`)
      log(`https://chipnet.imaginary.cash/tx/${revokeTxid}`)
    } catch (revokeError) {
      log(`Revoke was not broadcast: ${revokeError instanceof Error ? revokeError.message : String(revokeError)}`)
    }

    const stored = await engine.getInvitation(invitationIdentifier)
    if (!stored) throw new Error('Invitation disappeared after executeAction')
    writeFileSync(resolve(outDir, 'last-invitation.json'), serializeInvitation(stored.invitation))
    writeFileSync(
      resolve(outDir, 'last-run.json'),
      JSON.stringify(
        {
          templateIdentifier,
          invitationIdentifier,
          receiveAddress: address,
          commitment,
          bindTransactionHash: bindTxid,
          revokeTransactionHash: revokeTxid,
          transactionByteLength: executed.builtTransaction?.transactionByteLength,
          template: serializeTemplate(identityAnchorTemplate as never),
        },
        null,
        2,
      ),
    )
    log('Wrote xo/last-invitation.json and xo/last-run.json')
  } finally {
    await engine.stop()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
