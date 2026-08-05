import { useState } from 'react';
import { getRecipe } from '../../core/data/registry.js';
import { DAY_NAMES, attendeesFor } from '../../core/rules/context.js';
import type { RuleContext } from '../../core/rules/context.js';
import { explainMeal } from '../../core/planner/explain.js';
import type {
  DayIndex,
  Household,
  MealPlan,
  MealSlot,
  PlannedMeal,
} from '../../core/types.js';
import type { SolveResult } from '../../core/planner/solver.js';
import { AttendanceBar } from './AttendanceBar.js';

const DAYS: DayIndex[] = [0, 1, 2, 3, 4, 5, 6];
const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

interface Props {
  plan: MealPlan;
  household: Household;
  ctx: RuleContext;
  unfilled: SolveResult['unfilled'];
  onSwap: (day: DayIndex, slot: MealSlot) => void;
  onToggleAttendance: (personId: string, day: DayIndex, slot: MealSlot) => void;
  onRead: (meal: PlannedMeal) => void;
}

export function WeekBoard({
  plan,
  household,
  ctx,
  unfilled,
  onSwap,
  onToggleAttendance,
  onRead,
}: Props) {
  return (
    <section aria-label="This week's meals">
      <p className="eyebrow">The week</p>
      {DAYS.map((day) => {
        const meals = plan.meals
          .filter((m) => m.day === day)
          .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
        const gaps = unfilled.filter((u) => u.day === day);
        if (meals.length === 0 && gaps.length === 0) return null;

        return (
          <div className="day" key={day}>
            <div className="day__name">
              {DAY_NAMES[day]}
              <DayNote day={day} household={household} />
              <AttendanceBar
                day={day}
                household={household}
                onToggle={onToggleAttendance}
              />
            </div>
            <div className="day__meals">
              {meals.map((meal) => (
                <Meal
                  key={`${meal.day}-${meal.slot}`}
                  meal={meal}
                  household={household}
                  plan={plan}
                  ctx={ctx}
                  onSwap={onSwap}
                  onRead={onRead}
                />
              ))}
              {gaps.map((gap) => (
                <div className="meal meal--empty" key={`gap-${gap.slot}`}>
                  <span className="meal__slot">{gap.slot}</span>
                  <div>
                    <p className="meal__name">Nothing fits here</p>
                    <p className="meal__reason">{gap.reason}</p>
                  </div>
                  <button
                    className="btn btn--ghost"
                    onClick={() => onSwap(gap.day, gap.slot)}
                  >
                    Choose
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** Surfaces who's missing, since that's what explains an unusual choice. */
function DayNote({ day, household }: { day: DayIndex; household: Household }) {
  const dinner = attendeesFor(household, day, 'dinner');
  if (dinner.length === household.people.length) return null;
  const away = household.people.filter((p) => !dinner.some((d) => d.id === p.id));
  return <span className="day__note">{away.map((p) => p.name).join(', ')} out</span>;
}

function Meal({
  meal,
  household,
  plan,
  ctx,
  onSwap,
  onRead,
}: {
  meal: PlannedMeal;
  household: Household;
  plan: MealPlan;
  ctx: RuleContext;
  onSwap: (day: DayIndex, slot: MealSlot) => void;
  onRead: (meal: PlannedMeal) => void;
}) {
  const recipe = getRecipe(meal.recipeId);
  const attendees = attendeesFor(household, meal.day, meal.slot);
  const kidsOnly = attendees.length > 0 && !attendees.some((p) => p.ageBand === 'adult');
  const carried = meal.source === 'planned-over';
  // Computed only when opened — the one-out analysis isn't worth running for
  // every row on every render.
  const [why, setWhy] = useState(false);
  // Headcount at the table, shown on every meal. Distinct from portions, which
  // is age-weighted (a child counts less than a whole one). Highlighted when
  // it's short of the full household, since that's what explains a small cook.
  const eating = attendees.length;
  const everyoneIn = eating === household.people.length;

  return (
    <div className={`meal meal--${meal.slot}${carried ? ' meal--carried' : ''}`}>
      <span className="meal__slot">{meal.slot}</span>
      <div>
        {/* The dish name is the way into the recipe — the most likely thing to
            tap, and previously the only thing on the row that did nothing. */}
        <button className="meal__name meal__name--link" onClick={() => onRead(meal)}>
          {recipe.name}
        </button>
        <div className="meal__meta">
          {carried ? (
            <span>
              cooked {meal.cookedOn ? DAY_NAMES[meal.cookedOn.day] : 'earlier'} — just
              reheat
            </span>
          ) : (
            <span>{recipe.activeMinutes} min hands-on</span>
          )}
          <span>{meal.portions} portions</span>
          <span className={`meal__eating${everyoneIn ? '' : ' meal__eating--some'}`}>
            {eating} eating
          </span>
          <span>{recipe.cuisine}</span>
          {recipe.isNew && <span className="badge badge--new">New</span>}
          {kidsOnly && <span className="badge badge--kids">Kids cooking</span>}
        </div>
        <button
          className="meal__why-toggle"
          aria-expanded={why}
          onClick={() => setWhy((v) => !v)}
        >
          {why ? 'Hide reason' : 'Why this?'}
        </button>
        {why && <p className="meal__why">{explainMeal(meal, plan, ctx).sentence}</p>}
      </div>
      <div className="actions">
        <button
          className="btn btn--ghost"
          onClick={() => onRead(meal)}
          aria-label={`Cook ${recipe.name}`}
        >
          Cook
        </button>
        <button
          className="btn btn--ghost"
          onClick={() => onSwap(meal.day, meal.slot)}
          aria-label={`Change ${DAY_NAMES[meal.day]} ${meal.slot}`}
        >
          Change
        </button>
      </div>
    </div>
  );
}
