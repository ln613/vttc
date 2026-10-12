import { Dynamic } from 'solid-js/web'
import type { JSX } from 'solid-js'

// Line icons for the club website, picked by name from the content files
// ("court", "coach"…). All share one 24px grid and a 2px stroke.

const Svg = (props: { children: JSX.Element }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {props.children}
  </svg>
)

const Court = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 12h18M12 4v16" />
  </Svg>
)
const Shield = () => (
  <Svg>
    <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />
    <path d="M8.5 12l2.5 2.5 4.5-5" />
  </Svg>
)
const Ball = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <circle cx="9" cy="9" r="1" />
    <circle cx="15" cy="9" r="1" />
    <circle cx="12" cy="13" r="1" />
    <circle cx="8.5" cy="15" r="1" />
    <circle cx="15.5" cy="15" r="1" />
  </Svg>
)
const Coach = () => (
  <Svg>
    <path d="M2 9l10-5 10 5-10 5z" />
    <path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
  </Svg>
)
const Calendar = () => (
  <Svg>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2" />
  </Svg>
)
const Run = () => (
  <Svg>
    <circle cx="14" cy="4.5" r="2" />
    <path d="M7 21l3-6 3 2v4M9 12l2-4 4 2 3 3M11 8l-4 1-2 3" />
  </Svg>
)
const Trophy = () => (
  <Svg>
    <path d="M8 4h8v5a4 4 0 01-8 0z" />
    <path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8 21h8M9 17h6" />
  </Svg>
)
const Group = () => (
  <Svg>
    <circle cx="9" cy="8" r="3" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c2.8.2 5 2.5 5 5.5" />
  </Svg>
)
const Medal = () => (
  <Svg>
    <circle cx="12" cy="15" r="5" />
    <path d="M8.5 11L6 3h4l2 5 2-5h4l-2.5 8" />
  </Svg>
)
const Target = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" />
  </Svg>
)
const Sun = () => (
  <Svg>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
)
const Moon = () => (
  <Svg>
    <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />
  </Svg>
)
const Pin = () => (
  <Svg>
    <path d="M12 21s-7-6.2-7-12a7 7 0 0114 0c0 5.8-7 12-7 12z" />
    <circle cx="12" cy="9" r="2.5" />
  </Svg>
)
const Mail = () => (
  <Svg>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </Svg>
)
const Phone = () => (
  <Svg>
    <path d="M5 3h4l2 5-2.5 1.5a11 11 0 006 6L16 13l5 2v4a2 2 0 01-2 2A16 16 0 013 5a2 2 0 012-2z" />
  </Svg>
)
const Instagram = () => (
  <Svg>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
  </Svg>
)
const Globe = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
  </Svg>
)
const Palette = () => (
  <Svg>
    <path d="M12 3a9 9 0 000 18c1.4 0 2-1 2-2s-1-1.6-1-2.6 1-1.4 2-1.4h2a4 4 0 004-4c0-4.4-4-8-9-8z" />
    <circle cx="7.5" cy="11" r="1" fill="currentColor" />
    <circle cx="10" cy="7" r="1" fill="currentColor" />
    <circle cx="15" cy="7" r="1" fill="currentColor" />
  </Svg>
)
const Clipboard = () => (
  <Svg>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4V3h6v1M9 11l2 2 4-4M9 17h6" />
  </Svg>
)
const Sliders = () => (
  <Svg>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Svg>
)
const Check = () => (
  <Svg>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
)

const ICONS: Record<string, () => JSX.Element> = {
  court: Court,
  shield: Shield,
  ball: Ball,
  coach: Coach,
  cap: Coach,
  calendar: Calendar,
  run: Run,
  trophy: Trophy,
  group: Group,
  medal: Medal,
  target: Target,
  day: Sun,
  night: Moon,
  pin: Pin,
  mail: Mail,
  phone: Phone,
  instagram: Instagram,
  globe: Globe,
  palette: Palette,
  check: Check,
  clipboard: Clipboard,
  sliders: Sliders,
}

export const SiteIcon = (props: { name: string }) => (
  <Dynamic component={ICONS[props.name] ?? Court} />
)
