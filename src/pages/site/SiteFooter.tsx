import { langActions } from '../../stores/langStore'

// The foot of every website page: the club, how to reach it, and the privacy
// policy (a plain page, clubs/<slug>/public/privacy.html — Google's sign-in
// review looks for this link on the homepage).
const SiteFooter = () => {
  const brand = () => langActions.site().brand
  const contact = () => langActions.site().contact
  return (
    <footer class="ts-footer">
      <div class="ts-wrap ts-footer-inner">
        <span>
          © {new Date().getFullYear()} {brand().name}
        </span>
        <span>{contact().address}</span>
        <a href={`mailto:${contact().email}`}>{contact().email}</a>
        {/* rel="external": a real page, not one of the app's routes — without
            it the router would turn the click into #/privacy.html. */}
        <a href="/privacy.html" rel="external">
          {langActions.t('footer.privacy')}
        </a>
      </div>
    </footer>
  )
}

export default SiteFooter
