import { buildToday, type TodayMeal } from '../../core/planner/today.js';
import type { Household, MealPlan, Person, PlannedMeal } from '../../core/types.js';
import { MealRating, type Verdict } from './MealRating.js';

interface Props {
  plan: MealPlan | null;
  household: Household;
  /** Opens the existing RecipeView for a meal. */
  onCook: (meal: PlannedMeal) => void;
  /** Jump to the Week tab — the way out of every empty state. */
  onGoToWeek: () => void;
  /** Current verdict for a person on a dish, so a rating reads its state. */
  verdictOf: (recipeId: string, personId: string) => Verdict | undefined;
  /** Record a per-person verdict the moment it's tapped. */
  onRate: (recipeId: string, personId: string, verdict: Verdict, attendeeIds: string[]) => void;
  /** Injectable for tests; the app passes the real clock. */
  now?: Date;
}

/**
 * Today.
 *
 * A thin projection of the plan: all the thinking lives in
 * core/planner/today.ts, this only lays it out. Tonight's dinner leads, since
 * that's the decision most of the day is spent anticipating; the lighter meals
 * follow, and anything that has to happen tonight for tomorrow sits in a note
 * beneath.
 */
export function Today({ plan, household, onCook, onGoToWeek, verdictOf, onRate, now = new Date() }: Props) {
  const view = buildToday(plan, household, now);

  // A rating appears only once a slot has passed — the moment an opinion exists.
  const ratingFor = (m: TodayMeal) =>
    m.past ? (
      <MealRating
        people={m.attendees}
        verdictOf={(personId) => verdictOf(m.meal.recipeId, personId)}
        onRate={(personId, verdict) =>
          onRate(m.meal.recipeId, personId, verdict, m.attendees.map((p) => p.id))
        }
      />
    ) : null;

  if (view.status !== 'ok') {
    return (
      <section className="page" aria-label="Today">
        <div className="empty">
          <h2 className="empty__title">
            {view.status === 'no-plan' ? 'No plan yet' : 'Nothing on for today'}
          </h2>
          <p>{EMPTY_COPY[view.status]}</p>
          <p className="empty__aside">
            <button className="btn" onClick={onGoToWeek}>
              Open the week
            </button>
          </p>
        </div>
      </section>
    );
  }

  const dinner = view.dinner;
  const rest = view.meals.filter((m) => !m.hero);

  return (
    <section className="page today" aria-label="Today">
      {dinner && (
        <article className={`today__hero${dinner.carried ? ' today__hero--carried' : ''}`}>
          <p className="today__eyebrow">Tonight</p>
          <h2 className="today__dish">{dinner.recipe.name}</h2>
          <p className="today__facts">
            <span>{eatingLabel(dinner, household.people)}</span>
            <span aria-hidden="true">·</span>
            <span>{effortLabel(dinner)}</span>
            <span aria-hidden="true">·</span>
            <span>{dinner.recipe.cuisine}</span>
          </p>
          <button className="btn btn--primary today__cook" onClick={() => onCook(dinner.meal)}>
            {dinner.carried ? 'Open the recipe' : 'Cook this'}
          </button>
          {ratingFor(dinner)}
        </article>
      )}

      {view.comingUp.length > 0 && (
        <div className="today__coming" role="note">
          <p className="today__coming-head">Do tonight for tomorrow</p>
          <ul>
            {view.comingUp.map((c) => (
              <li key={`${c.kind}-${c.targetSlot}-${c.recipeId}`}>{c.message}</li>
            ))}
          </ul>
        </div>
      )}

      {rest.length > 0 && (
        <div className="today__rest">
          <p className="eyebrow">Also today</p>
          {rest.map((m) => (
            <div key={m.slot}>
              <div className="today__meal">
                <span className="today__slot">{m.slot}</span>
                <div className="today__meal-body">
                  <p className="today__meal-name">{m.recipe.name}</p>
                  <p className="today__meal-meta">
                    {eatingLabel(m, household.people)} · {effortLabel(m)}
                  </p>
                </div>
                <button
                  className="btn btn--ghost"
                  onClick={() => onCook(m.meal)}
                  aria-label={`Cook ${m.recipe.name}`}
                >
                  Cook
                </button>
              </div>
              {ratingFor(m)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const EMPTY_COPY: Record<string, string> = {
  'no-plan':
    "There's no plan for this week yet. Plan one and today fills itself in — tonight's dinner, who's eating, and what to start ahead.",
  'no-meals-today':
    'Today has no meals in the current plan. Open the week to add something or plan afresh.',
  'today-outside-week':
    "The saved plan isn't for this week. Open the week to plan the days you're in now.",
};

/** "Everyone", or the names when it's a smaller table. */
function eatingLabel(m: TodayMeal, everyone: Person[]): string {
  if (m.attendees.length === 0) return 'nobody in';
  if (m.attendees.length === everyone.length) return 'everyone eating';
  const names = m.attendees.map((p) => p.name);
  const joined =
    names.length <= 2
      ? names.join(' & ')
      : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
  return `${joined} eating`;
}

function effortLabel(m: TodayMeal): string {
  return m.carried ? 'just reheat' : `${m.handsOnMinutes} min hands-on`;
}
