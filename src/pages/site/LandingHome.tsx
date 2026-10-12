import { For, Show } from 'solid-js'
import { A } from '@solidjs/router'
import clubConfig from 'club-config'
import { Header } from '../../components/Header'
import { SiteIcon } from '../../site/SiteIcons'
import {
  landingText,
  landingMedia,
  type LandingShowcaseItem,
  type LandingPanel,
} from '../../site/landingContent'
import { langActions } from '../../stores/langStore'
import '../booking.css'
import './landing.css'

// The landing page: what the scoring and live-score system does, with the
// promo video up top. Its words and media come from clubs/<slug>/landing.json
// (src/site/landingContent.ts). See specs/pages/Landing.md.

// Someone who has asked for less motion gets the video still, with its
// controls, rather than playing on its own.
const prefersCalm =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// The fonts and colours are the club's own (clubs/<slug>/theme.css, through
// the .bk-site variables).
const LandingHome = () => (
  <div class="lp bk-site">
    <Header />
    <Hero />
    <Steps />
    <Showcase />
    <Features />
    <Brand />
    <Cta />
    <LandingFooter />
  </div>
)

const Hero = () => (
  <section class="lp-hero">
    <div class="lp-wrap lp-hero-inner">
      <div class="lp-hero-copy">
        <p class="lp-kicker">{landingText().hero.kicker}</p>
        <h1 class="lp-display">
          <For each={landingText().hero.title}>
            {(line) => <span class="lp-hero-line">{line}</span>}
          </For>
        </h1>
        <p class="lp-hero-text">{landingText().hero.text}</p>
        <div class="lp-actions">
          <A class="bk-btn bk-btn-primary lp-btn" href={landingText().hero.primary.href}>
            {landingText().hero.primary.label}
          </A>
          <A class="bk-btn lp-btn lp-btn-ghost" href={landingText().hero.secondary.href}>
            {landingText().hero.secondary.label}
          </A>
        </div>
      </div>
      <PromoVideo />
    </div>
  </section>
)

const PromoVideo = () => (
  <figure class="lp-video-frame">
    <span class="lp-live-badge">
      <span class="lp-live-dot" />
      LIVE
    </span>
    <video
      class="lp-video"
      src={landingMedia('video')}
      poster={landingMedia('poster')}
      autoplay={!prefersCalm}
      muted
      loop
      playsinline
      controls
      preload="metadata"
      aria-label={landingText().hero.videoLabel}
    />
    <figcaption class="lp-video-caption">{landingText().hero.videoLabel}</figcaption>
  </figure>
)

const Steps = () => (
  <section class="lp-section">
    <div class="lp-wrap">
      <SectionHead kicker={landingText().steps.kicker} title={landingText().steps.title} />
      <ol class="lp-steps">
        <For each={landingText().steps.items}>
          {(step, i) => (
            <li class="lp-step">
              <span class="lp-step-num">{String(i() + 1).padStart(2, '0')}</span>
              <span class="lp-step-title">{step.title}</span>
              <span class="lp-step-text">{step.text}</span>
            </li>
          )}
        </For>
      </ol>
    </div>
  </section>
)

const Showcase = () => (
  <section class="lp-section lp-section-tint">
    <div class="lp-wrap">
      <SectionHead kicker={landingText().showcase.kicker} title={landingText().showcase.title} />
      <div class="lp-rows">
        <For each={landingText().showcase.items}>
          {(item) => <ShowcaseRow item={item} />}
        </For>
      </div>
    </div>
  </section>
)

const CheckList = (props: { points: string[]; light?: boolean }) => (
  <ul class={props.light ? 'lp-points lp-points-light' : 'lp-points'}>
    <For each={props.points}>
      {(point) => (
        <li>
          <span class="lp-point-icon">
            <SiteIcon name="check" />
          </span>
          {point}
        </li>
      )}
    </For>
  </ul>
)

const ShowcaseRow = (props: { item: LandingShowcaseItem }) => (
  <article class="lp-row">
    <div class="lp-shot">
      <img src={landingMedia(props.item.image)} alt={props.item.title} loading="lazy" />
    </div>
    <div class="lp-row-copy">
      <p class="lp-tag">{props.item.tag}</p>
      <h3 class="lp-h3">{props.item.title}</h3>
      <p class="lp-text">{props.item.text}</p>
      <CheckList points={props.item.points} />
    </div>
  </article>
)

const Features = () => (
  <section class="lp-section">
    <div class="lp-wrap">
      <SectionHead kicker={landingText().features.kicker} title={landingText().features.title} />
      <div class="lp-features">
        <For each={landingText().features.items}>
          {(f) => (
            <div class="lp-feature">
              <span class="lp-feature-icon">
                <SiteIcon name={f.icon} />
              </span>
              <span class="lp-feature-title">{f.title}</span>
              <span class="lp-text">{f.text}</span>
            </div>
          )}
        </For>
      </div>
      <div class="lp-panels">
        <For each={landingText().features.panels}>
          {(panel) => <Panel panel={panel} />}
        </For>
      </div>
    </div>
  </section>
)

// A bigger card: the parts of the system with a list to show.
const Panel = (props: { panel: LandingPanel }) => (
  <div class="lp-panel">
    <span class="lp-feature-icon">
      <SiteIcon name={props.panel.icon} />
    </span>
    <h3 class="lp-h3">{props.panel.title}</h3>
    <p class="lp-text">{props.panel.text}</p>
    <CheckList points={props.panel.points} />
  </div>
)

// The same scoreboard in three clubs' colours: one system, many brands.
const Brand = () => (
  <section class="lp-section lp-brand">
    <div class="lp-wrap lp-brand-inner">
      <div class="lp-brand-copy">
        <p class="lp-kicker">{landingText().brand.kicker}</p>
        <h2 class="lp-h2">{landingText().brand.title}</h2>
        <p class="lp-brand-text">{landingText().brand.text}</p>
        <CheckList points={landingText().brand.points} light />
      </div>
      <div class="lp-samples" aria-hidden="true">
        <For each={landingText().brand.samples}>
          {(name) => (
            <div class="lp-sample">
              <span class="lp-sample-name">{name}</span>
              <span class="lp-sample-score">
                <span class="lp-sample-side">11</span>
                <span class="lp-sample-side">9</span>
              </span>
            </div>
          )}
        </For>
      </div>
    </div>
  </section>
)

const Cta = () => (
  <section class="lp-section">
    <div class="lp-wrap">
      <div class="lp-cta">
        <h2 class="lp-h2">{landingText().cta.title}</h2>
        <p class="lp-text">{landingText().cta.text}</p>
        <div class="lp-actions lp-actions-center">
          <a class="bk-btn bk-btn-primary lp-btn" href={`mailto:${landingText().cta.email}`}>
            {landingText().cta.button}
          </a>
          <span class="lp-cta-email">{landingText().cta.email}</span>
        </div>
      </div>
    </div>
  </section>
)

const SectionHead = (props: { kicker: string; title: string }) => (
  <div class="lp-head">
    <p class="lp-kicker">{props.kicker}</p>
    <h2 class="lp-h2">{props.title}</h2>
  </div>
)

// rel="external" on the privacy link: a real page, not one of the app's
// routes — without it the router would turn it into #/privacy.html.
const LandingFooter = () => (
  <footer class="lp-footer">
    <div class="lp-wrap lp-footer-inner">
      <span>
        © {new Date().getFullYear()} {clubConfig.name}
      </span>
      <a href={`mailto:${landingText().cta.email}`}>{landingText().cta.email}</a>
      <Show when={clubConfig.branding.privacyUrl}>
        {(url) => (
          <a href={url()} rel="external">
            {langActions.t('footer.privacy')}
          </a>
        )}
      </Show>
    </div>
  </footer>
)

export default LandingHome
