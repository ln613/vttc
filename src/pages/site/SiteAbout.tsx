import { onMount, type JSX } from 'solid-js'
import { Header } from '../../components/Header'
import { SiteIcon } from '../../site/SiteIcons'
import { siteImage, loadSiteFonts } from '../../site/siteContent'
import { langActions } from '../../stores/langStore'
import '../../site/site.css'
import SiteFooter from './SiteFooter'

// About the venue, and every way to reach the club: address, email, phone,
// Instagram, and the WhatsApp and WeChat codes. See specs/pages/Club Site.md.

const mapsUrl = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

const SiteAbout = () => {
  onMount(loadSiteFonts)
  const a = () => langActions.site().about
  const contact = () => langActions.site().contact
  return (
    <div class="ts-site">
      <Header />
      <header class="ts-pagehead">
        <div
          class="ts-wrap ts-stack"
          style={{ position: 'relative', 'z-index': 1 }}
        >
          <p class="ts-kicker">{a().kicker}</p>
          <h1 class="ts-display">{a().title}</h1>
          <p class="ts-lead" style={{ color: '#d9cffb' }}>
            {a().intro}
          </p>
        </div>
      </header>
      <section class="ts-section">
        <div class="ts-wrap ts-contact">
          <div class="ts-card">
            <h2 class="ts-h3">{a().contactTitle}</h2>
            <div class="ts-contact-list">
              <ContactRow icon="pin" label={a().address}>
                <span class="ts-contact-value">{contact().address}</span>
                <a
                  class="ts-link"
                  href={mapsUrl(contact().address)}
                  target="_blank"
                  rel="noopener"
                >
                  {a().map}
                </a>
              </ContactRow>
              <ContactRow icon="mail" label={a().email}>
                <a class="ts-contact-value" href={`mailto:${contact().email}`}>
                  {contact().email}
                </a>
              </ContactRow>
              <ContactRow icon="phone" label={a().phone}>
                <a
                  class="ts-contact-value"
                  href={`tel:${contact().phone.replace(/\D/g, '')}`}
                >
                  {contact().phone}
                </a>
              </ContactRow>
              <ContactRow icon="instagram" label={a().instagram}>
                <a
                  class="ts-contact-value"
                  href={`https://www.instagram.com/${contact().instagram}/`}
                  target="_blank"
                  rel="noopener"
                >
                  @{contact().instagram}
                </a>
              </ContactRow>
            </div>
          </div>
          <div class="ts-card">
            <h2 class="ts-h3">{a().scanTitle}</h2>
            <div class="ts-qrs">
              <div class="ts-qr">
                <img src={siteImage('qr-whatsapp')} alt={a().whatsapp} />
                <span class="ts-qr-name">{a().whatsapp}</span>
                <span class="ts-qr-note">{a().whatsappNote}</span>
              </div>
              <div class="ts-qr">
                <img src={siteImage('qr-wechat')} alt={a().wechat} />
                <span class="ts-qr-name">{a().wechat}</span>
                <span class="ts-qr-note">{a().wechatNote}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section class="ts-section" style={{ 'padding-top': 0 }}>
        <div class="ts-wrap ts-gallery">
          <img class="ts-g-wide" src={siteImage('lounge')} alt="" />
          <img class="ts-g-tall" src={siteImage('court-cart')} alt="" />
          <img class="ts-g-half" src={siteImage('hero-1')} alt="" />
          <img class="ts-g-half" src={siteImage('hero-2')} alt="" />
        </div>
      </section>
      <div class="ts-slogan ts-script">{langActions.site().home.slogan}</div>
      <SiteFooter />
    </div>
  )
}

const ContactRow = (props: {
  icon: string
  label: string
  children: JSX.Element
}) => (
  <div class="ts-contact-row">
    <span class="ts-icon-badge">
      <SiteIcon name={props.icon} />
    </span>
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '2px' }}>
      <span class="ts-contact-label">{props.label}</span>
      {props.children}
    </div>
  </div>
)

export default SiteAbout
