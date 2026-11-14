export const PROTOCOL_VERSION = 'kola-link:v1'

export const BINDING_KIND = 30078
export const BINDING_D_TAG = 'kola-link'

export const AUTH_KIND = 27235
export const ATTESTATION_KIND = 30078
export const ATTESTATION_D_PREFIX = 'kola-link-attestation:'

export const OP_RETURN_MAGIC = 'KOLA'

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
] as const

export const CHIPNET_EXPLORER_TX = 'https://chipnet.imaginary.cash/tx/'
export const MAINNET_EXPLORER_TX = 'https://explorer.imaginary.cash/tx/'

export const REPO_URL = 'https://github.com/mbanyadev/kola-link'
export const DEMO_URL = 'https://mbanyadev.github.io/kola-link/'
export const PRESENTATION_URL = 'https://mbanyadev.github.io/kola-link/presentation/'
export const KOLA_ID_REPO_URL = 'https://github.com/mbanyadev/kola-id'

/** Official BLAZE Widget Factory slides template. Our deck is a self-hosted HTML presentation styled for the same purpose. */
export const WIDGET_FACTORY_TEMPLATE_URL =
  'https://docs.google.com/presentation/d/1Yfuk9CJkf4U9M_WukcELhumWgj3Ak6345Ewy8hSp-Hk/edit'

export const CASHTOKENS_ADDRESS_PLACEHOLDER = 'NEEDS_REAL_CASHTOKENS_ADDRESS'

import { CashAddressNetworkPrefix } from '@bitauth/libauth'

export type BchNetwork = 'chipnet' | 'mainnet'

export const CASHADDR_PREFIX: Record<BchNetwork, CashAddressNetworkPrefix> = {
  chipnet: CashAddressNetworkPrefix.testnet,
  mainnet: CashAddressNetworkPrefix.mainnet,
}
