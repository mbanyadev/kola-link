import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertSuccess,
  CashAddressNetworkPrefix,
  generateBip39Mnemonic,
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

  const engine = await Engine.create(mnemonic, {
    network: XO_SUPPORTED_NETWORKS.chipnet,
    databasePath: resolve(outDir, '.xo-engine'),
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
    const bindIntent = intents.find((intent) => intent.action === 'bind')
    if (!bindIntent) throw new Error('bind intent missing from template')

    const commitment = statementCommitmentHex(
      `kola-link:v1|npub=${'ab'.repeat(32)}|bch=${address}|created=${Math.floor(Date.now() / 1000)}|nonce=${randomNonce()}`,
    )
    const created = await engine.createInvitation({
      templateIdentifier,
      actionIdentifier: 'bind',
      intent: bindIntent,
      variables: [
        { variableIdentifier: 'commitment', roleIdentifier: 'holder', value: commitment },
        { variableIdentifier: 'anchorSatoshis', roleIdentifier: 'holder', value: 10_000n },
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

    const change = await engine.calculateChange(invitationIdentifier)
    if (change && (change.valueSatoshis > 0n || change.tokens.length > 0)) {
      await engine.addChangeToInvitation(invitationIdentifier)
      log('Added change to the invitation')
    }

    const ownInputs = await engine.listOwnInputIndexes(invitationIdentifier)
    for (const inputIndex of ownInputs) {
      await engine.signInvitation(invitationIdentifier, inputIndex)
      log(`Signed input ${inputIndex}`)
    }

    const executed = await engine.executeAction(invitationIdentifier, {
      broadcastTransaction: true,
    })
    log(`executeAction result: ${JSON.stringify(executed, (_key, value) => typeof value === 'bigint' ? value.toString() : value)}`)

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
          executed,
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
