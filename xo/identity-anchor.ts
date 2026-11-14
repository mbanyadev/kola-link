/**
 * Kola Link identity-anchor XO template.
 *
 * bind    — fund a new output whose redeem script commits to sha256(statement)
 *            and can only be spent by the holder's key.
 * rotate  — spend that output to a new anchor with a new commitment (follow-up).
 * revoke  — spend the anchor back to the holder's plain P2PKH, ending the commitment.
 *
 * The commitment is baked into the redeem script, so the on-chain address itself
 * is unique per binding and can be checked without a side channel. That is the
 * advantage over an off-chain signed message alone: the commitment is timestamped
 * and public on chipnet (or mainnet), and rotate/revoke are authorised by spending
 * the same UTXO.
 */

const dummyIcon = '0000000000000000000000'

export const identityAnchorTemplate = {
  $schema: 'https://libauth.org/schemas/wallet-template-v0.schema.json',
  name: 'Kola Link identity-anchor',
  description:
    'Lock a Bitcoin Cash output that commits to a Kola Link npub↔wallet binding, then rotate or revoke it.',
  icon: 'anchor',
  version: '1',
  supported: ['BCH_2023_05', 'BCH_2024_05', 'BCH_2025_05', 'BCH_2026_05'],
  resources: [
    {
      name: 'Kola Link specification (KL-1)',
      description: 'Canonical binding statement, proofs, and verification rules.',
      url: 'https://github.com/mbanyadev/kola-link/blob/main/docs/SPEC.md',
    },
  ],
  roles: {
    holder: {
      name: 'Holder',
      description: 'The person who controls the bound Bitcoin Cash key.',
      icon: 'holder',
    },
  },
  defaults: {
    change: {
      output: 'changeOutput',
      role: 'holder',
      generate: ['holderKey'],
    },
    address: {
      lockingScript: 'holderP2pkh',
      role: 'holder',
      generate: ['holderKey'],
    },
    receive: {
      output: 'receiveOutput',
      role: 'holder',
      generate: ['holderKey'],
    },
  },
  start: [
    {
      action: 'receive',
      role: 'holder',
      generate: ['holderKey'],
    },
    {
      action: 'bind',
      role: 'holder',
      generate: ['holderKey'],
    },
  ],
  actions: {
    receive: {
      name: 'Receive',
      description: 'Receive Bitcoin Cash that can later fund an identity anchor.',
      icon: 'receive',
      roles: {
        holder: {
          name: 'Receive',
          description: 'Receive Bitcoin Cash to this identity account.',
          icon: 'receive',
          requirements: { secrets: ['holderKey'] },
        },
      },
      requirements: {
        participants: [{ role: 'holder', slots: { min: 1, max: 1 } }],
      },
      transaction: 'receiveTransaction',
    },
    bind: {
      name: 'Bind',
      description: 'Create an identity-anchor output that commits to a binding hash.',
      icon: 'bind',
      roles: {
        holder: {
          name: 'Bind',
          description: 'Fund a new identity-anchor output from this wallet.',
          icon: 'bind',
          requirements: {
            secrets: ['holderKey'],
            variables: ['commitment', 'anchorSatoshis'],
          },
        },
      },
      requirements: {
        participants: [{ role: 'holder', slots: { min: 1, max: 1 } }],
      },
      transaction: 'bindTransaction',
    },
    rotate: {
      name: 'Rotate',
      description: 'Replace the on-chain commitment with a new one, signed by the same holder key.',
      icon: 'rotate',
      roles: {
        holder: {
          name: 'Rotate',
          description: 'Spend the current anchor into a new anchor with a new commitment.',
          icon: 'rotate',
          requirements: {
            secrets: ['holderKey'],
            variables: ['newCommitment'],
          },
        },
      },
      requirements: {
        participants: [{ role: 'holder', slots: { min: 1, max: 1 } }],
      },
      transaction: 'rotateTransaction',
    },
    revoke: {
      name: 'Revoke',
      description: 'Spend the identity anchor back to a plain P2PKH address, ending the commitment.',
      icon: 'revoke',
      roles: {
        holder: {
          name: 'Revoke',
          description: 'Close the on-chain identity commitment and recover the locked satoshis.',
          icon: 'revoke',
          requirements: { secrets: ['holderKey'] },
        },
      },
      requirements: {
        participants: [{ role: 'holder', slots: { min: 1, max: 1 } }],
      },
      transaction: 'revokeTransaction',
    },
  },
  transactions: {
    receiveTransaction: {
      name: 'Received',
      description: 'Received funds into the holder wallet.',
      icon: 'receive',
      inputs: [],
      outputs: [{ output: 'receiveOutput', outputIndex: undefined }],
      version: 2,
      locktime: 0,
      composable: true,
    },
    bindTransaction: {
      name: 'Identity bound',
      description: 'Created an identity-anchor output committing to $(<commitment>).',
      icon: 'bind',
      inputs: [],
      outputs: [{ output: 'anchorOutput', outputIndex: undefined }],
      version: 2,
      locktime: 0,
      composable: true,
    },
    rotateTransaction: {
      name: 'Identity rotated',
      description: 'Replaced the on-chain commitment with $(<newCommitment>).',
      icon: 'rotate',
      inputs: [{ input: 'anchorInput', inputIndex: 0 }],
      outputs: [{ output: 'rotatedAnchorOutput', outputIndex: 0 }],
      version: 2,
      locktime: 0,
      composable: true,
    },
    revokeTransaction: {
      name: 'Identity revoked',
      description: 'Spent the identity anchor back to the holder.',
      icon: 'revoke',
      inputs: [{ input: 'anchorInput', inputIndex: 0 }],
      outputs: [{ output: 'revokeOutput', outputIndex: 0 }],
      version: 2,
      locktime: 0,
      composable: true,
    },
  },
  inputs: {
    anchorInput: {
      name: 'Identity anchor',
      description: 'The current identity-anchor output being spent.',
      icon: 'anchor',
      unlockingScript: 'unlockIdentityAnchor',
    },
  },
  outputs: {
    receiveOutput: {
      name: 'Holder receive',
      description: 'A standard P2PKH output owned by the holder.',
      icon: 'receive',
      lockingScript: 'holderP2pkh',
      token: null,
    },
    changeOutput: {
      name: 'Holder change',
      description: 'Change returned to the holder.',
      icon: 'receive',
      lockingScript: 'holderP2pkh',
      token: null,
    },
    anchorOutput: {
      name: 'Identity anchor',
      description: 'Output whose redeem script commits to the binding hash.',
      icon: 'anchor',
      lockingScript: 'identityAnchor',
      valueSatoshis: '$(<anchorSatoshis>)',
      token: null,
    },
    rotatedAnchorOutput: {
      name: 'Rotated identity anchor',
      description: 'A new identity-anchor output with the replacement commitment.',
      icon: 'rotate',
      lockingScript: 'rotatedAnchor',
      valueSatoshis: '$(rotatedAnchorSatoshis)',
      token: null,
    },
    revokeOutput: {
      name: 'Revoked funds',
      description: 'Satoshis recovered by the holder after revoking the anchor.',
      icon: 'revoke',
      lockingScript: 'holderP2pkh',
      valueSatoshis: '$(revokedSatoshis)',
      token: null,
    },
  },
  lockingScripts: {
    holderP2pkh: {
      name: 'Holder P2PKH',
      description: 'Standard pay-to-public-key-hash for the holder.',
      icon: 'holder',
      lockingType: 'p2pkh',
      lockingBytecode: 'lockHolderP2pkh',
      unlockingBytecode: 'unlockHolderP2pkh',
      actions: [],
      roles: {
        holder: {
          state: { variables: [], secrets: ['holderKey'] },
          actions: [
            {
              action: 'bind',
              role: 'holder',
              secrets: [{ holderKey: null }],
            },
          ],
        },
      },
    },
    identityAnchor: {
      name: 'Identity anchor',
      description: 'P2SH redeem script that commits to a binding hash and requires the holder signature.',
      icon: 'anchor',
      lockingType: 'p2sh',
      lockingBytecode: 'lockIdentityAnchor',
      unlockingBytecode: 'unlockIdentityAnchor',
      actions: [],
      state: { variables: ['commitment'], secrets: ['holderKey'] },
      roles: {
        holder: {
          state: { variables: ['commitment'], secrets: ['holderKey'] },
          actions: [
            {
              action: 'rotate',
              role: 'holder',
              secrets: [{ holderKey: null }],
              variables: [{ newCommitment: null }],
            },
            {
              action: 'revoke',
              role: 'holder',
              secrets: [{ holderKey: null }],
            },
          ],
        },
      },
    },
    rotatedAnchor: {
      name: 'Rotated identity anchor',
      description: 'The identity-anchor script after a rotation, committing to newCommitment.',
      icon: 'rotate',
      lockingType: 'p2sh',
      lockingBytecode: 'lockRotatedAnchor',
      unlockingBytecode: 'unlockIdentityAnchor',
      actions: [],
      state: { variables: ['newCommitment'], secrets: ['holderKey'] },
      roles: {
        holder: {
          state: { variables: ['newCommitment'], secrets: ['holderKey'] },
          actions: [
            {
              action: 'revoke',
              role: 'holder',
              secrets: [{ holderKey: null }],
            },
          ],
        },
      },
    },
  },
  scripts: {
    lockHolderP2pkh:
      'OP_DUP OP_HASH160 <$(<holderKey.public_key> OP_HASH160)> OP_EQUALVERIFY OP_CHECKSIG',
    unlockHolderP2pkh: '<holderKey.schnorr_signature.all_outputs> <holderKey.public_key>',
    lockIdentityAnchor:
      '<commitment> OP_DROP OP_DUP OP_HASH160 <$(<holderKey.public_key> OP_HASH160)> OP_EQUALVERIFY OP_CHECKSIG',
    lockRotatedAnchor:
      '<newCommitment> OP_DROP OP_DUP OP_HASH160 <$(<holderKey.public_key> OP_HASH160)> OP_EQUALVERIFY OP_CHECKSIG',
    unlockIdentityAnchor: '<holderKey.schnorr_signature.all_outputs> <holderKey.public_key>',
    rotatedAnchorSatoshis: '<anchorSatoshis> <minerFeeSatoshis> OP_SUB',
    revokedSatoshis: '<anchorSatoshis> <minerFeeSatoshis> OP_SUB',
  },
  constants: {
    minerFeeSatoshis: {
      name: 'Miner fee',
      description: 'Satoshis reserved for the rotate or revoke transaction fee.',
      type: 'satoshis',
      value: 400n,
    },
  },
  variables: {
    holderKey: {
      name: 'Holder key',
      description: 'The private key that controls the identity anchor.',
      type: 'private_key',
    },
    commitment: {
      name: 'Binding commitment',
      description: 'sha256 of the canonical Kola Link binding statement (32 bytes).',
      type: 'bytes',
    },
    newCommitment: {
      name: 'New binding commitment',
      description: 'Replacement sha256 commitment written by a rotate.',
      type: 'bytes',
    },
    anchorSatoshis: {
      name: 'Anchor amount',
      description: 'Satoshis locked in the identity-anchor output. Keep this above the dust limit.',
      type: 'satoshis',
    },
  },
  icons: [
    { name: 'anchor', hash: dummyIcon },
    { name: 'holder', hash: dummyIcon },
    { name: 'receive', hash: dummyIcon },
    { name: 'bind', hash: dummyIcon },
    { name: 'rotate', hash: dummyIcon },
    { name: 'revoke', hash: dummyIcon },
  ],
} as const

export type IdentityAnchorTemplate = typeof identityAnchorTemplate
