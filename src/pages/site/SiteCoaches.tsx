import { For, Show, onMount } from 'solid-js'
import { A } from '@solidjs/router'
import { Header } from '../../components/Header'
import { SiteIcon } from '../../site/SiteIcons'
import {
  siteImage,
  loadSiteFonts,
  type SiteCoach,
} from '../../site/siteContent'
import { langActions } from '../../stores/langStore'
import '../../site/site.css'

// The coaches: lesson formats, each coach's credentials, results and
// coaching style, and who the lessons suit. See specs/pages/Club Site.md.
const SiteCoaches = () => {
  onMount(loadSiteFonts)
  const c = () => langActions.site().coaches
  return (
    <div class="ts-site">
      <Header />
      <header class="ts-pagehead">
        <div
          class="ts-wrap ts-stack"
          style={{ position: 'relative', 'z-index': 1 }}
        >
          <p class="ts-kicker">{c().kicker}</p>
          <h1 class="ts-display">{c().title}</h1>
          <div class="ts-formats">
            <For each={c().formats}>
              {(f) => <span class="ts-format">{f}</span>}
            </For>
          </div>
          <p class="ts-formats-note">{c().formatsNote}</p>
        </div>
      </header>
      <section class="ts-section">
        <div class="ts-wrap">
          <For each={c().list}>{(coach) => <CoachCard coach={coach} />}</For>
          <p class="ts-motto ts-script">{c().motto}</p>
        </div>
      </section>
      <section class="ts-section" style={{ 'padding-top': 0 }}>
        <div class="ts-wrap">
          <h2 class="ts-h2">{c().audienceTitle}</h2>
          <div class="ts-audience">
            <For each={c().audience}>
              {(a) => (
                <div class="ts-audience-item">
                  <span class="ts-icon-badge">
                    <SiteIcon name={a.icon} />
                  </span>
                  <span>
                    <div class="ts-audience-title">{a.title}</div>
                    <div class="ts-audience-text">{a.text}</div>
                  </span>
                </div>
              )}
            </For>
          </div>
        </div>
      </section>
      <section class="ts-section ts-section-dark">
        <div class="ts-wrap ts-stack" style={{ 'align-items': 'flex-start' }}>
          <h2 class="ts-h2">
            <span class="ts-brush">{c().joinTitle}</span>
          </h2>
          <p class="ts-lead">{c().joinText}</p>
          <A class="ts-btn ts-btn-yellow" href="/about">
            {c().joinCta}
          </A>
        </div>
      </section>
    </div>
  )
}

const BlockTitle = (props: { icon: string; title: string }) => (
  <h4>
    <span class="ts-mini">
      <SiteIcon name={props.icon} />
    </span>
    {props.title}
  </h4>
)

const CoachCard = (props: { coach: SiteCoach }) => {
  const c = () => langActions.site().coaches
  return (
    <article class="ts-coach">
      <div class="ts-coach-id">
        <img src={siteImage(props.coach.photo)} alt={props.coach.name} />
        <h2 class="ts-coach-name">{props.coach.name}</h2>
        <span class="ts-rating">{props.coach.rating}</span>
        <p class="ts-coach-headline">{props.coach.headline}</p>
      </div>
      <div class="ts-coach-body">
        <div class="ts-coach-block">
          <BlockTitle icon="coach" title={c().credentialsTitle} />
          <ul class="ts-ticks">
            <For each={props.coach.credentials}>
              {(line) => <li>{line}</li>}
            </For>
          </ul>
        </div>
        <div class="ts-coach-block">
          <BlockTitle icon="trophy" title={c().achievementsTitle} />
          <ul class="ts-ticks">
            <For each={props.coach.achievements}>
              {(line) => <li>{line}</li>}
            </For>
          </ul>
        </div>
        <div class="ts-coach-block ts-coach-teaching">
          <BlockTitle icon="target" title={c().teachingTitle} />
          <ul class="ts-ticks">
            <For each={props.coach.teaching}>
              {(item) => (
                <li>
                  <b>{item.title}</b> · {item.text}
                </li>
              )}
            </For>
          </ul>
        </div>
        <Show when={props.coach.quote}>
          <p class="ts-quote">“{props.coach.quote}”</p>
        </Show>
      </div>
    </article>
  )
}

export default SiteCoaches
