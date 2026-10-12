import { Show } from 'solid-js'
import clubConfig from 'club-config'
import './club-banner.css'

// The banner of a club without a website (branding.banner in its config):
// a background image — never stretched, whatever the width; a club can give
// a simpler crop for phones — with the logo, name, services and tagline laid
// over it as text.
// Its colours and fonts come from the club's theme (club-banner.css reads
// --banner-* variables; clubs/<slug>/theme.css sets them).
const ClubBanner = () => {
  const banner = clubConfig.branding.banner!
  return (
    <div
      class="club-banner"
      style={{
        '--banner-image': `url("${banner.background}")`,
        '--banner-image-mobile': `url("${banner.backgroundMobile ?? banner.background}")`,
      }}
    >
      <div class="club-banner-inner">
        <img class="club-banner-logo" src={banner.logo} alt="" />
        <div class="club-banner-text">
          <span class="club-banner-name">{banner.name}</span>
          <Show when={banner.services}>
            <span class="club-banner-services">{banner.services}</span>
          </Show>
        </div>
        <Show when={banner.tagline}>
          <span class="club-banner-tagline">{banner.tagline}</span>
        </Show>
      </div>
    </div>
  )
}

export default ClubBanner
