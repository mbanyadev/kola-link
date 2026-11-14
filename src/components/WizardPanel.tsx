import { publicKeyToP2pkhCashAddress } from '@bitauth/libauth'
import { useMemo } from 'react'
import { useWizardConnect, WizardConnectQRDialog } from '@wizardconnect/react'
import type { BchNetwork } from '../lib/constants.ts'
import { prefixFor } from '../lib/keys.ts'

type Props = {
  network: BchNetwork
  onAddress: (cashaddr: string) => void
}

export default function WizardPanel({ network, onAddress }: Props) {
  const wc = useWizardConnect({
    dappName: 'Kola Link',
    sessionKey: 'kola-link-wizardconnect',
  })

  const derivedAddress = useMemo(() => {
    if (wc.state !== 'connected' || !wc.manager) return null
    const publicKey = wc.manager.getPubkey(0, 0n)
    if (!publicKey) return null
    const encoded = publicKeyToP2pkhCashAddress({
      publicKey,
      prefix: prefixFor(network),
      tokenSupport: false,
    })
    return encoded.address
  }, [wc.state, wc.manager, network])

  return (
    <div className="card">
      <h3>Paytaca / Selene via WizardConnect</h3>
      <p>
        For a real wallet path, connect Paytaca, Selene, or Cashonize with
        WizardConnect. The first receive address is used as the BCH identity.
        The demo still works with a local chipnet key if you do not have a
        wallet handy.
      </p>
      <div className="row">
        <button type="button" onClick={() => wc.connect()} disabled={wc.state === 'connecting' || wc.state === 'connected'}>
          Connect wallet
        </button>
        <button type="button" className="ghost" onClick={() => void wc.disconnect()} disabled={wc.state === 'idle'}>
          Disconnect
        </button>
        {derivedAddress && (
          <button type="button" className="kola" onClick={() => onAddress(derivedAddress)}>
            Use this address
          </button>
        )}
      </div>
      <p className="status">
        State: {wc.state}
        {wc.walletName ? ` · ${wc.walletName}` : ''}
        {wc.error ? ` · ${wc.error}` : ''}
      </p>
      {derivedAddress && <p className="mono">{derivedAddress}</p>}
      {wc.uri && wc.qrUri && (
        <WizardConnectQRDialog
          show={wc.state === 'connecting'}
          onClose={() => void wc.disconnect()}
          uri={wc.uri}
          qrUri={wc.qrUri}
          title="Kola Link"
          subtitle="Scan with Paytaca, Selene, or Cashonize"
        />
      )}
    </div>
  )
}
