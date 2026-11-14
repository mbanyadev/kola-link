import { hexToBin } from '@bitauth/libauth'
import { useEffect, useMemo, useState } from 'react'
import Banner from './components/Banner.tsx'
import WizardPanel from './components/WizardPanel.tsx'
import {
  ATTRIBUTE_LABELS,
  randomSalt,
  saltAttribute,
  verifyDisclosure,
  type AttestationAttribute,
  type IssuedAttestation,
} from './lib/attestations.ts'
import { signBitcoinMessage } from './lib/bch-message.ts'
import type { BchNetwork } from './lib/constants.ts'
import {
  CHIPNET_EXPLORER_TX,
  DEMO_URL,
  PRESENTATION_URL,
  REPO_URL,
} from './lib/constants.ts'
import {
  bchKeypairFromHex,
  decodeNpub,
  encodeNpub,
  generateBchKeypair,
  generateNostrKeypair,
  nostrKeypairFromNsec,
  type BchKeypair,
  type NostrKeypair,
} from './lib/keys.ts'
import {
  buildAttestationTemplate,
  buildAuthTemplate,
  buildBindingTemplate,
  lookupBindingByCashaddr,
  lookupBindingByNpub,
  parseBindingContent,
  publishToRelays,
  signAttestationEvent,
  signAuthEvent,
  signBindingEvent,
  verifyAuthEvent,
  type NostrEvent,
} from './lib/nostr.ts'
import {
  loadBch,
  loadNetwork,
  loadNostr,
  saveBch,
  saveNetwork,
  saveNostr,
} from './lib/storage.ts'
import { encodeStatement, randomNonce, statementCommitmentHex } from './lib/statement.ts'
import { verifyBindingEvent } from './lib/verify.ts'

const LINKS = [
  ['#create', 'Create'],
  ['#bind', 'Bind'],
  ['#discover', 'Discover'],
  ['#sawa', 'Sawa Market'],
  ['#pay', 'Pay by name'],
  ['#kumba', 'Kumba Verify'],
  ['#xo', 'XO anchor'],
]

export default function App() {
  const [network, setNetwork] = useState<BchNetwork>('chipnet')
  const [nostr, setNostr] = useState<NostrKeypair | null>(null)
  const [bch, setBch] = useState<BchKeypair | null>(null)
  const [nsecInput, setNsecInput] = useState('')
  const [wizardAddress, setWizardAddress] = useState<string | null>(null)
  const [boundEvent, setBoundEvent] = useState<NostrEvent | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [lookupQuery, setLookupQuery] = useState('')
  const [lookupEvent, setLookupEvent] = useState<NostrEvent | null>(null)
  const [authNonce] = useState(() => randomNonce().slice(0, 16))
  const [authEvent, setAuthEvent] = useState<NostrEvent | null>(null)
  const [issuer, setIssuer] = useState<NostrKeypair | null>(null)
  const [attestation, setAttestation] = useState<IssuedAttestation | null>(null)
  const [country, setCountry] = useState('CM')
  const [discloseAttr, setDiscloseAttr] = useState<AttestationAttribute>('over18')
  const [discloseValue, setDiscloseValue] = useState('true')
  const [discloseSalt, setDiscloseSalt] = useState('')
  const [payQuery, setPayQuery] = useState('')
  const [payAddress, setPayAddress] = useState('')

  useEffect(() => {
    setNetwork(loadNetwork())
    setNostr(loadNostr())
    const stored = loadBch()
    if (stored) setBch(stored)
  }, [])

  const cashaddr = wizardAddress ?? bch?.cashaddr ?? ''

  const statement = useMemo(() => {
    if (!nostr || !cashaddr) return null
    return {
      version: 'kola-link:v1' as const,
      npubHex: nostr.publicKeyHex,
      cashaddr,
      created: Math.floor(Date.now() / 1000),
      nonce: randomNonce(),
    }
  }, [nostr, cashaddr])

  function rememberNostr(keys: NostrKeypair | null) {
    setNostr(keys)
    saveNostr(keys)
  }

  function rememberBch(keys: BchKeypair | null) {
    setBch(keys)
    saveBch(keys)
  }

  function switchNetwork(next: BchNetwork) {
    setNetwork(next)
    saveNetwork(next)
    if (bch && bch.network !== next) {
      rememberBch(bchKeypairFromHex(bch.privateKeyHex, next))
    }
  }

  async function importNsec() {
    try {
      rememberNostr(nostrKeypairFromNsec(nsecInput.trim()))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function importNip07() {
    if (!window.nostr) {
      setError('No NIP-07 extension found. Try Alby or nos2x, or use a demo nsec.')
      return
    }
    try {
      const publicKeyHex = await window.nostr.getPublicKey()
      rememberNostr({
        secretKeyHex: '',
        publicKeyHex,
        nsec: '',
        npub: encodeNpub(publicKeyHex),
      })
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function bindAndPublish() {
    setError('')
    setStatus('Building the binding…')
    try {
      if (!nostr || !statement || !cashaddr) throw new Error('Create both identities first.')
      if (!bch?.privateKeyHex) {
        throw new Error('A local demo key is needed to sign the Bitcoin Cash message in this demo. Connect a wallet for the address, or generate a chipnet key.')
      }
      const encoded = encodeStatement(statement)
      const commitment = statementCommitmentHex(encoded)
      const signature = signBitcoinMessage(encoded, hexToBin(bch.privateKeyHex))
      const template = buildBindingTemplate(statement, commitment, [
        { type: 'bitcoin-message', signature },
      ], cashaddr)
      let event: NostrEvent
      if (nostr.secretKeyHex) {
        event = signBindingEvent(template, nostr.secretKeyHex)
      } else if (window.nostr) {
        event = await window.nostr.signEvent(template)
      } else {
        throw new Error('No Nostr signer is available.')
      }
      const checked = verifyBindingEvent(event, network)
      if (!checked.ok) throw new Error(checked.reason)
      setBoundEvent(event)
      setStatus('Publishing to public relays…')
      const results = await publishToRelays(event)
      const ok = results.filter((item) => item.ok).map((item) => item.relay)
      const failed = results.filter((item) => !item.ok)
      setStatus(
        ok.length
          ? `Published binding ${event.id.slice(0, 12)}… to ${ok.join(', ')}${failed.length ? `. Failed: ${failed.map((item) => item.relay).join(', ')}` : ''}.`
          : 'Relays did not acknowledge the event. You can still verify the local signed event below.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('')
    }
  }

  async function discover() {
    setError('')
    setLookupEvent(null)
    try {
      const query = lookupQuery.trim()
      if (!query) throw new Error('Enter an npub, hex pubkey, or cashaddr.')
      const event = query.includes(':')
        ? await lookupBindingByCashaddr(query)
        : await lookupBindingByNpub(decodeNpub(query))
      if (!event) throw new Error('No binding event found on the default relays.')
      setLookupEvent(event)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function signIntoSawa() {
    setError('')
    try {
      if (!nostr) throw new Error('Create a Nostr identity first.')
      if (!boundEvent && !lookupEvent) throw new Error('Bind or look up an identity first.')
      const eventToCheck = boundEvent ?? lookupEvent
      if (!eventToCheck) throw new Error('No binding to authenticate.')
      const verified = verifyBindingEvent(eventToCheck, network)
      if (!verified.ok) throw new Error(verified.reason)
      if (verified.npubHex !== nostr.publicKeyHex) {
        throw new Error('The bound npub is not the one currently selected.')
      }
      const expires = Math.floor(Date.now() / 1000) + 300
      const template = buildAuthTemplate('sawa.market', window.location.origin, authNonce, expires)
      const event = nostr.secretKeyHex
        ? signAuthEvent(template, nostr.secretKeyHex)
        : window.nostr
          ? await window.nostr.signEvent(template)
          : null
      if (!event) throw new Error('No Nostr signer is available.')
      const auth = verifyAuthEvent(event, {
        app: 'sawa.market',
        origin: window.location.origin,
        nonce: authNonce,
        expires,
        npubHex: nostr.publicKeyHex,
      })
      if (!auth.ok) throw new Error(auth.reason)
      setAuthEvent(event)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function issueBadge() {
    setError('')
    try {
      if (!nostr) throw new Error('The subject needs a Nostr identity.')
      const issuerKeys = issuer ?? generateNostrKeypair()
      if (!issuer) setIssuer(issuerKeys)
      const salt = randomSalt()
      const issued: IssuedAttestation = {
        issuerNpub: issuerKeys.publicKeyHex,
        subjectNpub: nostr.publicKeyHex,
        issuedAt: Math.floor(Date.now() / 1000),
        commitments: {
          over18: saltAttribute(salt, 'over18', 'true'),
          country: saltAttribute(salt, 'country', country),
          merchant: saltAttribute(salt, 'merchant', 'true'),
        },
      }
      const template = buildAttestationTemplate(issued, nostr.publicKeyHex)
      signAttestationEvent(template, issuerKeys.secretKeyHex)
      setAttestation(issued)
      setDiscloseSalt(salt)
      setDiscloseValue('true')
      setStatus('Kumba Verify issued a salted attestation. The salt stays with the holder until they disclose an attribute.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const disclosure = attestation
    ? verifyDisclosure(attestation, {
        attribute: discloseAttr,
        value: discloseAttr === 'country' ? country : discloseValue,
        salt: discloseSalt,
      })
    : null

  async function resolvePay() {
    setError('')
    setPayAddress('')
    try {
      const query = payQuery.trim()
      const event = query.includes(':')
        ? await lookupBindingByCashaddr(query)
        : await lookupBindingByNpub(decodeNpub(query))
      if (!event) throw new Error('No binding found for that identity.')
      const verified = verifyBindingEvent(event, network)
      if (!verified.ok) throw new Error(verified.reason)
      setPayAddress(verified.cashaddr)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const localVerified = boundEvent ? verifyBindingEvent(boundEvent, network) : null
  const lookedUpVerified = lookupEvent ? verifyBindingEvent(lookupEvent, network) : null

  return (
    <>
      <Banner />
      <div className="page">
        <nav className="topnav">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>

        <header className="hero">
          <div>
            <p className="eyebrow">Bitcoin Cash × Nostr · BLAZE 2026</p>
            <h1>
              A name you can <em>pay</em>, a key you still own.
            </h1>
            <p className="lede">
              Kola Link binds a Bitcoin Cash wallet to a Nostr key in about a
              minute. Any app can verify the link from public relays and a
              signature — no server of ours, and no shared private key.
            </p>
          </div>
          <div className="hero-card">
            <p className="eyebrow">The 60-second path</p>
            <ol>
              <li>Create or connect a Nostr key and a Bitcoin Cash address.</li>
              <li>Sign one canonical statement with both keys.</li>
              <li>Publish the proof to public relays.</li>
              <li>Any app looks it up, checks the signatures, and logs you in.</li>
            </ol>
          </div>
        </header>

        {error && <p className="status bad">{error}</p>}
        {status && <p className="status ok">{status}</p>}

        <section className="block" id="create">
          <h2>1. Create the two identities</h2>
          <p className="section-lead">
            Keys stay in this browser, or in a NIP-07 extension and a
            WizardConnect wallet. Kola Link never custodially holds them.
          </p>
          <div className="row" style={{ marginBottom: 16 }}>
            <span className="pill">Network</span>
            <div className="toggle">
              <button type="button" aria-pressed={network === 'chipnet'} onClick={() => switchNetwork('chipnet')}>
                Chipnet (default, free)
              </button>
              <button type="button" aria-pressed={network === 'mainnet'} onClick={() => switchNetwork('mainnet')}>
                Mainnet
              </button>
            </div>
            {network === 'mainnet' && (
              <span className="pill warn">Mainnet is optional. This entry targets bounties that allow chipnet.</span>
            )}
          </div>
          <div className="grid-2">
            <div className="card">
              <h3>Nostr identity</h3>
              <p>
                Use a NIP-07 signer (Alby, nos2x) or generate a demo nsec in the
                browser. The demo key is stored only in localStorage on this
                device.
              </p>
              <div className="row">
                <button type="button" onClick={() => rememberNostr(generateNostrKeypair())}>
                  Generate demo key
                </button>
                <button type="button" className="ghost" onClick={() => void importNip07()}>
                  Use NIP-07 extension
                </button>
              </div>
              <label htmlFor="nsec">Or paste an nsec (demo only)</label>
              <input id="nsec" value={nsecInput} onChange={(event) => setNsecInput(event.target.value)} placeholder="nsec1…" autoComplete="off" />
              <div className="row">
                <button type="button" className="secondary" onClick={() => void importNsec()}>
                  Import nsec
                </button>
              </div>
              {nostr && (
                <dl className="kv">
                  <div>
                    <dt>npub</dt>
                    <dd className="mono">{nostr.npub}</dd>
                  </div>
                </dl>
              )}
            </div>
            <div className="card">
              <h3>Bitcoin Cash identity</h3>
              <p>
                Generate a chipnet key for the self-contained demo, or take an
                address from a connected wallet. The two keys are never the same
                secret.
              </p>
              <div className="row">
                <button type="button" onClick={() => rememberBch(generateBchKeypair(network))}>
                  Generate {network} key
                </button>
              </div>
              {bch && (
                <dl className="kv">
                  <div>
                    <dt>cashaddr</dt>
                    <dd className="mono">{bch.cashaddr}</dd>
                  </div>
                  <div>
                    <dt>WIF (local demo key — do not reuse on mainnet funds)</dt>
                    <dd className="mono">{bch.wif}</dd>
                  </div>
                </dl>
              )}
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <WizardPanel network={network} onAddress={setWizardAddress} />
            {wizardAddress && (
              <p className="status">
                Using WizardConnect address <span className="mono">{wizardAddress}</span>. A local
                key is still required in this demo to produce the Bitcoin Cash
                signed message unless you paste a matching WIF.
              </p>
            )}
          </div>
        </section>

        <section className="block" id="bind">
          <h2>2. Cryptographic binding</h2>
          <p className="section-lead">
            The app writes a canonical statement, the Nostr key signs a
            replaceable kind-30078 event, and the Bitcoin Cash key signs the
            same statement with a standard signed message. Listing an address in
            a profile is not enough — both proofs of control are checked.
          </p>
          <div className="card">
            <h3>Canonical statement</h3>
            {statement ? (
              <p className="mono">{encodeStatement(statement)}</p>
            ) : (
              <p>Create both identities to see the statement.</p>
            )}
            <div className="row">
              <button type="button" className="kola" onClick={() => void bindAndPublish()} disabled={!statement}>
                Sign and publish to relays
              </button>
            </div>
            {localVerified && (
              <p className={localVerified.ok ? 'status ok' : 'status bad'}>
                {localVerified.ok
                  ? `Local verification passed. Commitment ${localVerified.commitment.slice(0, 16)}…`
                  : localVerified.reason}
              </p>
            )}
            {boundEvent && (
              <label>
                Signed binding event
                <textarea readOnly value={JSON.stringify(boundEvent, null, 2)} />
              </label>
            )}
          </div>
        </section>

        <section className="block" id="discover">
          <h2>3. Discover and verify</h2>
          <p className="section-lead">
            Third parties look the binding up on public Nostr relays — by npub
            (<code>#d=kola-link</code>) or by cashaddr (<code>#i=bch:…</code>).
            Verification is a pure function: check the Nostr signature, recompute
            the commitment, and recover the Bitcoin Cash key from the signed
            message.
          </p>
          <div className="card">
            <label htmlFor="lookup">npub, hex pubkey, or cashaddr</label>
            <input id="lookup" value={lookupQuery} onChange={(event) => setLookupQuery(event.target.value)} placeholder="npub1… or bchtest:…" />
            <div className="row">
              <button type="button" onClick={() => void discover()}>
                Look up on relays
              </button>
              {boundEvent && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setLookupQuery(nostr?.npub ?? cashaddr)}
                >
                  Use my identity
                </button>
              )}
            </div>
            {lookedUpVerified && (
              <p className={lookedUpVerified.ok ? 'status ok' : 'status bad'}>
                {lookedUpVerified.ok
                  ? `Verified. npub ${encodeNpub(lookedUpVerified.npubHex)} is bound to ${lookedUpVerified.cashaddr}`
                  : lookedUpVerified.reason}
              </p>
            )}
            {lookupEvent && (
              <p className="mono">Event {lookupEvent.id} · {parseBindingContent(lookupEvent).proofs.map((proof) => proof.type).join(', ')}</p>
            )}
          </div>
        </section>

        <section className="block" id="sawa">
          <h2>4. Sawa Market — independent login</h2>
          <p className="section-lead">
            A relying app does not call any Kola Link server. It issues a
            challenge, the holder signs a NIP-98-style event, and the app checks
            that signature against a verified binding.
          </p>
          <div className="card">
            <p>
              Challenge nonce <span className="mono">{authNonce}</span>
            </p>
            <div className="row">
              <button type="button" onClick={() => void signIntoSawa()}>
                Sign in as a verified BCH holder
              </button>
            </div>
            {authEvent && (
              <p className="status ok">
                Welcome to Sawa Market. Badge: Verified Bitcoin Cash holder
                ({encodeNpub(authEvent.pubkey).slice(0, 16)}…).
              </p>
            )}
          </div>
        </section>

        <section className="block" id="pay">
          <h2>5. Pay someone by their identity</h2>
          <p className="section-lead">
            Stretch goal: resolve an npub (or a looked-up cashaddr) to a verified
            payment address without asking them to paste it in chat.
          </p>
          <div className="card">
            <label htmlFor="pay">npub or already-known cashaddr</label>
            <input id="pay" value={payQuery} onChange={(event) => setPayQuery(event.target.value)} placeholder="npub1…" />
            <div className="row">
              <button type="button" onClick={() => void resolvePay()}>
                Resolve payment address
              </button>
            </div>
            {payAddress && (
              <p className="status ok">
                Pay <span className="mono">{payAddress}</span>. On chipnet you can
                also inspect it in the{' '}
                <a href={`${CHIPNET_EXPLORER_TX}`} target="_blank" rel="noreferrer">
                  chipnet explorer
                </a>
                . Sending coins still happens in your wallet.
              </p>
            )}
          </div>
        </section>

        <section className="block" id="kumba">
          <h2>6. Kumba Verify — selective disclosure</h2>
          <p className="section-lead">
            Stretch goal: an issuer publishes salted hash commitments (over 18,
            country, merchant). The holder reveals one attribute plus the salt;
            the verifier recomputes the hash. Nothing else is disclosed.
          </p>
          <div className="grid-2">
            <div className="card">
              <h3>Issuer</h3>
              <label htmlFor="country">Country code to commit</label>
              <input id="country" value={country} onChange={(event) => setCountry(event.target.value)} />
              <div className="row">
                <button type="button" onClick={issueBadge}>
                  Issue attestation
                </button>
              </div>
              {attestation && (
                <p className="mono">Issuer {encodeNpub(attestation.issuerNpub).slice(0, 20)}… committed {Object.keys(attestation.commitments).join(', ')}.</p>
              )}
            </div>
            <div className="card">
              <h3>Holder disclosure</h3>
              <label htmlFor="attr">Attribute</label>
              <select id="attr" value={discloseAttr} onChange={(event) => setDiscloseAttr(event.target.value as AttestationAttribute)}>
                {(Object.keys(ATTRIBUTE_LABELS) as AttestationAttribute[]).map((key) => (
                  <option key={key} value={key}>
                    {ATTRIBUTE_LABELS[key]}
                  </option>
                ))}
              </select>
              {discloseAttr !== 'country' && (
                <>
                  <label htmlFor="dval">Value</label>
                  <input id="dval" value={discloseValue} onChange={(event) => setDiscloseValue(event.target.value)} />
                </>
              )}
              <label htmlFor="salt">Salt (held by the holder)</label>
              <input id="salt" value={discloseSalt} onChange={(event) => setDiscloseSalt(event.target.value)} />
              {disclosure && (
                <p className={disclosure.ok ? 'status ok' : 'status bad'}>
                  {disclosure.ok
                    ? `Verified: ${ATTRIBUTE_LABELS[discloseAttr]} holds, and the other attributes stay hidden.`
                    : disclosure.reason}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="block" id="xo">
          <h2>7. XO identity-anchor</h2>
          <p className="section-lead">
            For the Build with XO bounty, Kola Link ships a novel template with
            bind, rotate, and revoke. The redeem script drops a 32-byte
            commitment then checks the holder signature, so the on-chain address
            itself is unique per binding. Run it on chipnet; invitations can be
            inspected in the XO debug tool.
          </p>
          <div className="card">
            <p>
              Template identifier:{' '}
              <span className="mono">719cabf1d86ee1c3ea3cd7c98b09f7638823fe1074cca8b1ca95e55a5c59464c</span>
            </p>
            <div className="row">
              <a className="btn" href={`${import.meta.env.BASE_URL}xo/identity-anchor.template.json`}>
                Download template JSON
              </a>
              <a className="btn ghost" href="https://blaze.xo.cash/" target="_blank" rel="noreferrer">
                Open XO debug tool
              </a>
              <a className="btn secondary" href="https://github.com/mbanyadev/kola-link/blob/main/xo/REPRODUCE.md">
                Reproduction steps
              </a>
            </div>
            <p>
              Use <code>npm run xo:bind</code> in the repo after funding a chipnet
              receive address from{' '}
              <a href="https://chipnet.bch.ninja/" target="_blank" rel="noreferrer">
                chipnet.bch.ninja
              </a>
              . The script writes the invitation used to execute the transaction.
            </p>
          </div>
        </section>

        <footer>
          <p>
            <a href={REPO_URL}>Source</a>
            {' · '}
            <a href={PRESENTATION_URL}>Presentation</a>
            {' · '}
            <a href={DEMO_URL}>Live demo</a>
            {' · '}
            Built by Mbanya Dev for BCH BLAZE 2026.
          </p>
        </footer>
      </div>
    </>
  )
}
