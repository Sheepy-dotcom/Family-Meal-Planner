export type Tab = 'meals' | 'shop' | 'people' | 'recipes' | 'settings';

/**
 * Bottom navigation.
 *
 * A "More" menu at the top of the screen is a web pattern: it hides features
 * behind a click, and on a phone it sits at the far end of the thumb's reach.
 * Labelled tabs at the bottom mean every part of the app is one tap away and
 * visible without exploring — which is what "where is the profile section?"
 * turned out to be about.
 *
 * Five, not six: Today and Week are two views of the same thing, so they share
 * one "Meals" tab with a segmented control. A sixth tab truncated its label and
 * narrowed every target below a comfortable thumb on a small phone.
 *
 * The icons are inline SVG, not a font glyph or an image file: they inherit the
 * tab's colour through `currentColor` (so the active accent and dark mode come
 * for free), stay crisp at any density, and add nothing to load — which matters
 * for the offline mobile build. Each pictures its tab plainly: a place setting
 * for meals, a basket for shop, a person for people, an open book for recipes,
 * sliders for settings.
 */
const TABS: Array<{ id: Tab; label: string; needsPlan?: boolean }> = [
  { id: 'meals', label: 'Meals' },
  { id: 'shop', label: 'Shop', needsPlan: true },
  { id: 'people', label: 'People', needsPlan: true },
  { id: 'recipes', label: 'Recipes' },
  { id: 'settings', label: 'Settings' },
];

/** One line-drawn glyph per tab, stroked in the current text colour. */
function TabIcon({ tab }: { tab: Tab }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (tab) {
    case 'meals': // fork & knife — a place setting
      return (
        <svg {...common}>
          <path d="M6 3v6a2 2 0 0 0 4 0V3" />
          <path d="M8 9v12" />
          <path d="M17 3c-1.6 1.5-2.2 4.2-1 6.4.3.6 1 .8 1 1.5V21" />
        </svg>
      );
    case 'shop': // shopping basket
      return (
        <svg {...common}>
          <path d="M4.5 8h15l-1.3 10.6a2 2 0 0 1-2 1.75H7.8a2 2 0 0 1-2-1.75L4.5 8Z" />
          <path d="M8 8a4 4 0 0 1 8 0" />
          <path d="M9.7 12v4M14.3 12v4" />
        </svg>
      );
    case 'people': // a person
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.3" />
          <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
        </svg>
      );
    case 'recipes': // an open book
      return (
        <svg {...common}>
          <path d="M12 6.6C10.4 5.1 7.8 4.6 4 5.2v12.6c3.8-.6 6.4-.1 8 1.4 1.6-1.5 4.2-2 8-1.4V5.2c-3.8-.6-6.4-.1-8 1.4Z" />
          <path d="M12 6.6V19.2" />
        </svg>
      );
    case 'settings': // sliders
      return (
        <svg {...common}>
          <path d="M4 8h9M18.5 8H20M4 16h1.5M11 16h9" />
          <circle cx="15.5" cy="8" r="2.4" />
          <circle cx="8" cy="16" r="2.4" />
        </svg>
      );
  }
}

interface Props {
  active: Tab;
  hasPlan: boolean;
  /** Number of items still needed, shown on the Shop tab. */
  shopCount?: number;
  /** Suggestions waiting, shown on People. */
  noticeCount?: number;
  onSelect: (tab: Tab) => void;
}

export function TabBar({ active, hasPlan, shopCount, noticeCount, onSelect }: Props) {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((tab) => {
        // Tabs that need a plan stay visible but inert, so the app's shape is
        // consistent from the first launch rather than growing as you use it.
        const disabled = !!tab.needsPlan && !hasPlan;
        const badge =
          tab.id === 'shop' ? shopCount : tab.id === 'people' ? noticeCount : undefined;

        return (
          <button
            key={tab.id}
            className={`tabbar__tab ${active === tab.id ? 'tabbar__tab--on' : ''}`}
            aria-current={active === tab.id ? 'page' : undefined}
            aria-disabled={disabled}
            disabled={disabled}
            onClick={() => onSelect(tab.id)}
          >
            <span className="tabbar__icon" aria-hidden="true">
              <TabIcon tab={tab.id} />
              {!!badge && badge > 0 && <span className="tabbar__badge">{badge}</span>}
            </span>
            <span className="tabbar__label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
