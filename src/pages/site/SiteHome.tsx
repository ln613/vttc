import { For, onMount, onCleanup, createSignal } from 'solid-js'
import { A } from '@solidjs/router'
import { Header } from '../../components/Header'
import { SiteIcon } from '../../site/SiteIcons'
import { heroImages, siteImage, loadSiteFonts } from '../../site/siteContent'
import { langActions } from '../../stores/langStore'
import '../../site/site.css'

// The club's home page: a rotating photo hero, what the venue offers, the
// coaches, the venue, and the club's motto. See specs/pages/Club Site.md.

const SLIDE_MS = 5500

const SiteHome = () => {
  onMount(loadSiteFonts)
  return (
    <div class="ts-site">
      <Header />
      <Hero />
      <div class="ts-wrap">
        <Features />
      </div>
      <Intro />
      <CoachTeaser />
      <Venue />
      <div class="ts-slogan ts-script">{langActions.site().home.slogan}</div>
    </div>
  )
}

// The slide on show is the hero's own state: nothing else reads it.
const Hero = () => {
  const slides = heroImages()
  const [current, setCurrent] = createSignal(0)
  const next = () => setCurrent((i) => (i + 1) % slides.length)
  onMount(() => {
    const timer = setInterval(next, SLIDE_MS)
    onCleanup(() => clearInterval(timer))
  })
  const home = () => langActions.site().home
  const brand = () => langActions.site().brand
  return (
    <section class="ts-hero">
      <For each={slides}>
        {(src, i) => (
          <div
            class={`ts-hero-slide${current() === i() ? ' is-on' : ''}`}
            style={{ 'background-image': `url(${src})` }}
            role="presentation"
          />
        )}
      </For>
      <div class="ts-wrap ts-hero-inner">
        <div class="ts-hero-brand">
          <img
            class="ts-hero-logo"
            src={siteImage('logo')}
            alt={brand().name}
          />
          <h1 class="ts-display">
            <For each={home().heroTitle}>
              {(line) => <span style={{ display: 'block' }}>{line}</span>}
            </For>
          </h1>
        </div>
        <p class="ts-hero-tagline ts-script">{brand().tagline}</p>
        <p class="ts-hero-services">{brand().services}</p>
        <div class="ts-hero-actions">
          <A class="ts-btn ts-btn-yellow" href="/booking">
            {home().bookCourt}
          </A>
          <A class="ts-btn ts-btn-ghost" href="/pricing">
            {home().seePricing}
          </A>
        </div>
        <div class="ts-hero-dots">
          <For each={slides}>
            {(_, i) => (
              <button
                type="button"
                class={`ts-hero-dot${current() === i() ? ' is-on' : ''}`}
                aria-label={`${i() + 1} / ${slides.length}`}
                onClick={() => setCurrent(i())}
              />
            )}
          </For>
        </div>
      </div>
    </section>
  )
}

const Features = () => (
  <div class="ts-features">
    <For each={langActions.site().home.features}>
      {(f) => (
        <div class="ts-feature">
          <span class="ts-icon-badge">
            <SiteIcon name={f.icon} />
          </span>
          <span class="ts-feature-title">{f.title}</span>
          <span class="ts-feature-text">{f.text}</span>
        </div>
      )}
    </For>
  </div>
)

const Intro = () => (
  <section class="ts-section">
    <div class="ts-wrap ts-split">
      <div class="ts-stack">
        <p class="ts-kicker">{langActions.site().home.introKicker}</p>
        <h2 class="ts-h2">{langActions.site().home.introTitle}</h2>
        <p class="ts-lead">{langActions.site().home.intro}</p>
      </div>
      <img
        class="ts-photo ts-photo-tilt"
        src={siteImage('court-cart')}
        alt=""
      />
    </div>
  </section>
)

const CoachTeaser = () => (
  <section class="ts-section ts-section-dark">
    <div class="ts-wrap ts-split">
      <div class="ts-stack">
        <p class="ts-kicker">{langActions.site().home.coachKicker}</p>
        <h2 class="ts-h2">{langActions.site().home.coachTitle}</h2>
        <p class="ts-lead">{langActions.site().home.coachText}</p>
        <div>
          <A class="ts-btn ts-btn-yellow" href="/coaches">
            {langActions.site().home.coachCta}
          </A>
        </div>
      </div>
      <div class="ts-coach-faces">
        <For each={langActions.site().coaches.list}>
          {(c) => (
            <div class="ts-face">
              <img src={siteImage(c.photo)} alt={c.name} />
              <span class="ts-face-name">{c.name}</span>
              <span class="ts-rating">{c.rating}</span>
            </div>
          )}
        </For>
      </div>
    </div>
  </section>
)

const Venue = () => (
  <section class="ts-section">
    <div class="ts-wrap ts-stack">
      <p class="ts-kicker">{langActions.site().home.venueKicker}</p>
      <h2 class="ts-h2">{langActions.site().home.venueTitle}</h2>
      <div class="ts-gallery" style={{ 'margin-top': '14px' }}>
        <img class="ts-g-wide" src={siteImage('venue-strip')} alt="" />
        <img class="ts-g-tall" src={siteImage('hero-3')} alt="" />
        <img class="ts-g-half" src={siteImage('lounge')} alt="" />
        <img class="ts-g-half" src={siteImage('hero-4')} alt="" />
      </div>
    </div>
  </section>
)

export default SiteHome
