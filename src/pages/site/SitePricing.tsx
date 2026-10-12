import { For, onMount } from 'solid-js'
import { A } from '@solidjs/router'
import { Header } from '../../components/Header'
import { SiteIcon } from '../../site/SiteIcons'
import { loadSiteFonts } from '../../site/siteContent'
import { langState, langActions } from '../../stores/langStore'
import { priceGroups } from '../../site/pricing'
import '../../site/site.css'
import SiteFooter from './SiteFooter'

// Court rental prices by day and time of day. See specs/pages/Club Site.md.
const SitePricing = () => {
  onMount(loadSiteFonts)
  const p = () => langActions.site().pricing
  return (
    <div class="ts-site">
      <Header />
      <header class="ts-pagehead">
        <div
          class="ts-wrap ts-stack"
          style={{ position: 'relative', 'z-index': 1 }}
        >
          <p class="ts-kicker">{p().kicker}</p>
          <h1 class="ts-display">
            <span class="ts-brush">{p().title}</span>
          </h1>
        </div>
      </header>
      <section
        class="ts-section ts-section-dark"
        style={{ 'padding-top': '36px' }}
      >
        <div class="ts-wrap">
          <div class="ts-price-table">
            <div class="ts-price-head">
              <div>{p().headers.days}</div>
              <div>{p().headers.time}</div>
              <div>{p().headers.price}</div>
            </div>
            <For each={priceGroups(langState.lang)}>
              {(group) => (
                <div class="ts-price-group">
                  <div class="ts-price-days">
                    <span class="ts-days-pill">{group.days}</span>
                  </div>
                  <div class="ts-price-rows">
                    <For each={group.rows}>
                      {(row) => (
                        <div class="ts-price-row">
                          <span class="ts-price-time">
                            <SiteIcon name={row.period} />
                            {row.time}
                          </span>
                          <span class="ts-price">
                            <b>${row.price}</b>
                            <span>{p().perHour}</span>
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </div>
          <div class="ts-price-foot">
            <span class="ts-price-tagline ts-script">{p().tagline}</span>
            <A class="ts-btn ts-btn-yellow" href="/booking">
              {p().bookCta}
            </A>
          </div>
          <p class="ts-lead" style={{ 'margin-top': '26px' }}>
            {p().coachingNote}{' '}
            <A
              class="ts-link"
              href="/coaches"
              style={{ color: 'var(--ts-yellow)' }}
            >
              {p().coachingCta}
            </A>
          </p>
        </div>
      </section>
      <SiteFooter />
    </div>
  )
}

export default SitePricing
