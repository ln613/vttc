import { onMount } from 'solid-js'
import { siteImage, loadSiteFonts } from '../site/siteContent'
import { langActions } from '../stores/langStore'
import '../site/site.css'

// The banner of a club with its own website, built like its home hero: a
// photo of the court as a cropped background (it can't stretch, whatever
// the width), with the logo, name, services and tagline laid over it as
// text — in the current language. See specs/shared/header.md.
const SiteBanner = () => {
  onMount(loadSiteFonts)
  const brand = () => langActions.site().brand
  return (
    <div
      class="ts-site ts-banner"
      style={{ 'background-image': `url("${siteImage('hero-2')}")` }}
    >
      <div class="ts-wrap ts-banner-inner">
        <img class="ts-banner-logo" src={siteImage('logo')} alt="" />
        <div class="ts-banner-text">
          <span class="ts-banner-name ts-display">{brand().name}</span>
          <span class="ts-banner-services">{brand().services}</span>
        </div>
        <span class="ts-banner-tagline ts-script">{brand().tagline}</span>
      </div>
    </div>
  )
}

export default SiteBanner
