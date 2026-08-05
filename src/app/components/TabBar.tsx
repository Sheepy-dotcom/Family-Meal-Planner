export type Tab = 'today' | 'week' | 'shop' | 'people' | 'recipes' | 'settings';

/**
 * Bottom navigation.
 *
 * A "More" menu at the top of the screen is a web pattern: it hides features
 * behind a click, and on a phone it sits at the far end of the thumb's reach.
 * Labelled tabs at the bottom mean every part of the app is one tap away and
 * visible without exploring — which is what "where is the profile section?"
 * turned out to be about.
 *
 * Today leads: on most opens the question is "what's for tonight", not "is the
 * week sound", so it's both the first tab and the default view.
 */
const TABS: Array<{ id: Tab; label: string; icon: string; needsPlan?: boolean }> = [
  { id: 'today', label: 'Today', icon: '◉' },
  { id: 'week', label: 'Week', icon: '▤' },
  { id: 'shop', label: 'Shop', icon: '▦', needsPlan: true },
  { id: 'people', label: 'People', icon: '◍', needsPlan: true },
  { id: 'recipes', label: 'Recipes', icon: '✎' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

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
              {tab.icon}
              {!!badge && badge > 0 && <span className="tabbar__badge">{badge}</span>}
            </span>
            <span className="tabbar__label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
