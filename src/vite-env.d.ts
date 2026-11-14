/// <reference types="vite/client" />

type Nip07Signer = {
  getPublicKey: () => Promise<string>
  signEvent: (event: {
    kind: number
    created_at: number
    tags: string[][]
    content: string
  }) => Promise<import('nostr-tools').Event>
}

interface Window {
  nostr?: Nip07Signer
}
