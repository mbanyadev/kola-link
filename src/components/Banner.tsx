import {
  CASHTOKENS_ADDRESS_PLACEHOLDER,
  DEMO_URL,
  KOLA_ID_REPO_URL,
  PRESENTATION_URL,
  REPO_URL,
  WIDGET_FACTORY_TEMPLATE_URL,
} from '../lib/constants.ts'

export default function Banner() {
  return (
    <aside className="banner" id="banner">
      <div className="banner-inner">
        <p>
          <strong>BCH BLAZE 2026 entry — Kola Link.</strong> This is a client-side
          demo on Bitcoin Cash chipnet by default. It is not custody, not a
          securities product, and not financial advice.
        </p>
        <p>
          Presentation:{' '}
          <a href={PRESENTATION_URL} target="_blank" rel="noreferrer">
            short deck
          </a>
          {' · '}
          official Widget Factory template:{' '}
          <a href={WIDGET_FACTORY_TEMPLATE_URL} target="_blank" rel="noreferrer">
            Google Slides template
          </a>
          {' · '}
          source:{' '}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            {REPO_URL.replace('https://', '')}
          </a>
          {' · '}
          live demo:{' '}
          <a href={DEMO_URL} target="_blank" rel="noreferrer">
            {DEMO_URL.replace('https://', '')}
          </a>
        </p>
        <p className="warn">
          Community Choice CashTokens address:{' '}
          <strong>{CASHTOKENS_ADDRESS_PLACEHOLDER}</strong> — placeholder only.
          A real token-aware Bitcoin Cash address must be inserted here before
          the BUIDL is submitted if we want EMBER2026 votes to count. We do not
          currently have one, and this project does not spend money to create
          one.
        </p>
        <p>
          Concept reused from{' '}
          <a href={KOLA_ID_REPO_URL} target="_blank" rel="noreferrer">
            Kola ID (Midnight)
          </a>
          . All Bitcoin Cash and Nostr product code in this repository was written
          during BLAZE on 14 November 2026. A local toolchain scaffold existed
          before the hackathon and is declared here; it is not this public repo.
        </p>
      </div>
    </aside>
  )
}
