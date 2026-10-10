import type { JSX } from 'solid-js'
import { hasSite } from './siteContent'

// A club with its own website styles an element by class, in its site's
// look (booking.css, .bk-site); every other club keeps the inline style it
// always had. `{...themed(sectionStyle, 'bk-card')}`
export const themed = (plain: JSX.CSSProperties, siteClass: string) =>
  hasSite() ? { class: siteClass } : { style: plain }
