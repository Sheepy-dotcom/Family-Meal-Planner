import { Shell } from './Shell.js';
import { useModal } from '../useModal.js';
import { Fragment, useState } from 'react';
import { ALLERGENS, ALLERGEN_LABELS } from '../../core/data/allergens.js';
import { checkFeasibility, checkVariety } from '../../core/planner/feasibility.js';
import { GOAL_LABELS, GOAL_HINTS, canSetGoal } from '../../core/people/goals.js';
import { DIETS, DIET_LABELS, DIET_HINTS } from '../../core/people/diet.js';
import { DAYS, DAY_NAMES } from '../../core/rules/context.js';
import type { RuleContext } from '../../core/rules/context.js';
import type {
  Allergen,
  DayIndex,
  EatingGoal,
  Household,
  MealSlot,
  Person,
} from '../../core/types.js';

interface Props {
  /** 'page' drops the modal chrome so this can sit inside a tab. */
  variant?: 'sheet' | 'page';
  household: Household;
  ctx: RuleContext;
  onChange: (household: Household) => void;
  /** Wipe everything on this device and return to the welcome screen. */
  onReset: () => void;
  onClose: () => void;
}

const EDITABLE_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

/**
 * Settings, with the consequences shown as you type.
 *
 * The panel at the top recalculates on every keystroke. Tighten Tuesday to ten
 * minutes and it tells you immediately that nothing fits, and which rule to
 * relax. Letting someone quietly make their own week impossible and only
 * finding out after they press Plan is the failure mode this exists to avoid.
 */
export function HouseholdEditor({ household, ctx, onChange, onReset, onClose , variant = 'sheet' }: Props) {
  const dialogRef = useModal(onClose, variant === 'sheet');
  // People collapse into a summary row each, so Settings opens as a short,
  // scannable list rather than four full editors stacked on top of each other.
  // Null means all closed; one is open at a time.
  const [openId, setOpenId] = useState<string | null>(null);
  const liveCtx: RuleContext = { ...ctx, household };
  const report = checkFeasibility(liveCtx);
  const varietyWarnings = checkVariety(liveCtx);

  function updatePerson(id: string, patch: Partial<Person>) {
    onChange({
      ...household,
      people: household.people.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  }

  function addPerson() {
    const person: Person = {
      id: `person-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: '',
      ageBand: 'adult',
      portionFactor: 1,
      dietary: { avoidAllergens: [], dislikedIngredients: [], dislikedTags: [] },
      goal: 'balanced',
    };
    onChange({ ...household, people: [...household.people, person] });
    setOpenId(person.id); // a fresh person opens ready to fill in
  }

  /**
   * Removing a person also drops the rows that only made sense for them — their
   * away-from-the-table marks — so no orphaned references are left behind. The
   * last person can't be removed: a household of nobody has nothing to plan for.
   */
  function removePerson(id: string) {
    if (household.people.length <= 1) return;
    const person = household.people.find((p) => p.id === id);
    const label = person?.name?.trim() || 'this person';
    if (
      !window.confirm(
        `Remove ${label} from the household? Their preferences and who-eats-what are deleted. This can't be undone.`,
      )
    )
      return;
    onChange({
      ...household,
      people: household.people.filter((p) => p.id !== id),
      absences: household.absences.filter((a) => a.personId !== id),
    });
  }

  function toggleAllergen(person: Person, allergen: Allergen) {
    const has = person.dietary.avoidAllergens.includes(allergen);
    updatePerson(person.id, {
      dietary: {
        ...person.dietary,
        avoidAllergens: has
          ? person.dietary.avoidAllergens.filter((a) => a !== allergen)
          : [...person.dietary.avoidAllergens, allergen],
      },
    });
  }

  function toggleAbsence(personId: string, day: DayIndex, slot: MealSlot) {
    const away = household.absences.some(
      (a) => a.personId === personId && a.day === day && a.slot === slot,
    );
    onChange({
      ...household,
      absences: away
        ? household.absences.filter(
            (a) => !(a.personId === personId && a.day === day && a.slot === slot),
          )
        : [...household.absences, { personId, day, slot }],
    });
  }

  function setBudget(day: DayIndex, slot: MealSlot, minutes: number) {
    const rest = household.timeBudgets.filter(
      (b) => !(b.day === day && b.slot === slot),
    );
    onChange({
      ...household,
      timeBudgets:
        minutes > 0 ? [...rest, { day, slot, maxActiveMinutes: minutes }] : rest,
    });
  }

  return (
    <Shell variant={variant} dialogRef={dialogRef} onClose={onClose} label={"Household settings"}>
      <div className="sheet sheet--wide" onClick={(e) => e.stopPropagation()}>
        {/* As a tab the masthead already names this screen; the heading only
            earns its place when this is a pop-up sheet. */}
        {variant === 'sheet' && (
          <div className="sheet__head">
            <h2>Household</h2>
            <button className="btn btn--ghost" onClick={onClose}>
              Done
            </button>
          </div>
        )}

        {/* Live consequences, above everything else. */}
        <div className={report.ok && varietyWarnings.length === 0 ? 'status' : 'warn'}>
          <h3>{report.ok ? 'These settings work' : 'These settings collide'}</h3>
          {report.impossible.length > 0 && (
            <ul>
              {report.impossible.slice(0, 4).map((s) => (
                <li key={`${s.day}-${s.slot}`}>{s.message}</li>
              ))}
            </ul>
          )}
          {varietyWarnings.length > 0 && (
            <ul>
              {varietyWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          {report.ok && varietyWarnings.length === 0 && (
            <p>
              {report.tight.length > 0
                ? `Every slot can be filled, though ${report.tight.length} ${report.tight.length === 1 ? 'has' : 'have'} few options and will repeat.`
                : 'Every slot has room to vary week to week.'}
            </p>
          )}
        </div>

        {/* --- people --- */}
        <p className="eyebrow">Who eats here</p>
        {household.people.map((person) => {
          const open = openId === person.id;
          const diet = person.dietary.diet;
          const dietLabel = diet && diet !== 'omnivore' ? DIET_LABELS[diet] : null;
          const glutenFree = person.dietary.avoidAllergens.includes('gluten');
          const otherAllergens = person.dietary.avoidAllergens.filter((a) => a !== 'gluten').length;
          const awayCount = household.absences.filter((a) => a.personId === person.id).length;
          return (
          <div className={`editor-block person-card ${open ? 'person-card--open' : ''}`} key={person.id}>
            {/* Collapsed row: who they are at a glance, tap to edit. */}
            <button
              type="button"
              className="person-card__head"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : person.id)}
            >
              <span className="person-card__name">{person.name.trim() || 'New person'}</span>
              <span className="person-card__tags">
                <span className="person-card__tag">{ageLabel(person.ageBand)}</span>
                {dietLabel && <span className="person-card__tag">{dietLabel}</span>}
                {glutenFree && <span className="person-card__tag">Gluten-free</span>}
                {otherAllergens > 0 && (
                  <span className="person-card__tag">
                    {otherAllergens} allergen{otherAllergens === 1 ? '' : 's'}
                  </span>
                )}
                {awayCount > 0 && <span className="person-card__tag">{awayCount} away</span>}
              </span>
              <span className="person-card__chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
            </button>

            {open && (
            <div className="person-card__body">
            {household.people.length > 1 && (
              <div className="editor-block__head">
                <button
                  className="link-danger"
                  onClick={() => removePerson(person.id)}
                  aria-label={`Remove ${person.name || 'this person'} from the household`}
                >
                  Remove
                </button>
              </div>
            )}
            <div className="field-row">
              <label className="field">
                <span>Name</span>
                <input
                  value={person.name}
                  onChange={(e) => updatePerson(person.id, { name: e.target.value })}
                />
              </label>
              <label className="field field--narrow">
                <span>Age</span>
                <select
                  value={person.ageBand}
                  onChange={(e) =>
                    updatePerson(person.id, {
                      ageBand: e.target.value as Person['ageBand'],
                    })
                  }
                >
                  <option value="adult">Adult</option>
                  <option value="teen">Teen</option>
                  <option value="child">Child</option>
                </select>
              </label>
              <label className="field field--narrow">
                <span>Portion</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.3"
                  max="2"
                  value={person.portionFactor}
                  onChange={(e) =>
                    updatePerson(person.id, {
                      portionFactor: Number(e.target.value) || 1,
                    })
                  }
                />
              </label>
            </div>

            <p className="field__hint">{person.name || 'This person'}'s diet</p>
            <div className="chips">
              {DIETS.map((d) => {
                const on = (person.dietary.diet ?? 'omnivore') === d;
                return (
                  <button
                    key={d}
                    className={`chip ${on ? 'chip--in' : ''}`}
                    aria-pressed={on}
                    onClick={() =>
                      updatePerson(person.id, {
                        dietary: { ...person.dietary, diet: d },
                      })
                    }
                  >
                    {DIET_LABELS[d]}
                  </button>
                );
              })}
            </div>
            <p className="goal-hint">{DIET_HINTS[person.dietary.diet ?? 'omnivore']}</p>

            {/* Coeliac isn't a diet, it's a gluten exclusion — offered here as a
                plain shortcut that sets the same gluten allergen as the list
                below, so the two always agree. */}
            <div className="chips" style={{ marginTop: 8 }}>
              {(() => {
                const coeliac = person.dietary.avoidAllergens.includes('gluten');
                return (
                  <button
                    className={`chip ${coeliac ? 'chip--on' : ''}`}
                    aria-pressed={coeliac}
                    onClick={() => toggleAllergen(person, 'gluten')}
                  >
                    Coeliac · gluten-free
                  </button>
                );
              })()}
            </div>

            {/* Goals are adults-only by design — a child should never be shown
                a target for their own eating. `canSetGoal` enforces it in the
                engine too, so data alone can't route round this. */}
            {canSetGoal(person) && (
              <>
                <p className="field__hint">What {person.name} wants from meals</p>
                <div className="chips">
                  {(Object.keys(GOAL_LABELS) as EatingGoal[]).map((goal) => {
                    const on = (person.goal ?? 'balanced') === goal;
                    return (
                      <button
                        key={goal}
                        className={`chip ${on ? 'chip--in' : ''}`}
                        aria-pressed={on}
                        onClick={() => updatePerson(person.id, { goal })}
                      >
                        {GOAL_LABELS[goal]}
                      </button>
                    );
                  })}
                </div>
                <p className="goal-hint">{GOAL_HINTS[person.goal ?? 'balanced']}</p>
              </>
            )}

            <p className="field__hint">Never serve {person.name}</p>
            <div className="chips">
              {ALLERGENS.map((allergen) => {
                const on = person.dietary.avoidAllergens.includes(allergen);
                return (
                  <button
                    key={allergen}
                    className={`chip ${on ? 'chip--on' : ''}`}
                    aria-pressed={on}
                    onClick={() => toggleAllergen(person, allergen)}
                  >
                    {ALLERGEN_LABELS[allergen]}
                  </button>
                );
              })}
            </div>

            <p className="field__hint">Away from the table</p>
            <div className="grid-away">
              <span />
              {DAYS.map((day) => (
                <span className="grid-away__head" key={day}>
                  {DAY_NAMES[day].slice(0, 3)}
                </span>
              ))}
              {EDITABLE_SLOTS.filter((s) => household.plannedSlots.includes(s)).map(
                (slot) => (
                  <Fragment key={slot}>
                    <span className="grid-away__slot">{slot}</span>
                    {DAYS.map((day) => {
                      const away = household.absences.some(
                        (a) =>
                          a.personId === person.id && a.day === day && a.slot === slot,
                      );
                      return (
                        <button
                          key={`${slot}-${day}`}
                          className={`cell ${away ? 'cell--away' : ''}`}
                          aria-pressed={away}
                          aria-label={`${person.name}, ${DAY_NAMES[day]} ${slot}`}
                          onClick={() => toggleAbsence(person.id, day, slot)}
                        >
                          {away ? '·' : ''}
                        </button>
                      );
                    })}
                  </Fragment>
                ),
              )}
            </div>
            </div>
            )}
          </div>
          );
        })}

        <button className="btn btn--ghost btn--addperson" onClick={addPerson}>
          + Add a person
        </button>

        {/* --- time budgets --- */}
        <p className="eyebrow">Minutes you'll actually stand at the hob</p>
        <p className="field__hint">
          Hands-on time, not oven time. This is the setting that decides whether a
          plan survives a Tuesday — leave it blank for no limit.
        </p>
        <div className="editor-block">
          {DAYS.map((day) => {
            const budget = household.timeBudgets.find(
              (b) => b.day === day && b.slot === 'dinner',
            );
            const slotReport = report.slots.find(
              (s) => s.day === day && s.slot === 'dinner',
            );
            return (
              <div className="budget-row" key={day}>
                <span className="budget-row__day">{DAY_NAMES[day]}</span>
                <input
                  type="number"
                  min="0"
                  step="5"
                  placeholder="no limit"
                  value={budget?.maxActiveMinutes ?? ''}
                  onChange={(e) => setBudget(day, 'dinner', Number(e.target.value) || 0)}
                />
                <span
                  className={`budget-row__count budget-row__count--${slotReport?.pressure ?? 'comfortable'}`}
                >
                  {slotReport ? `${slotReport.eligible} dishes fit` : 'nobody eating'}
                </span>
              </div>
            );
          })}
        </div>

        <p className="field__hint">
          Settings save as you change them. Your current plan stays as it is until
          you generate a new one.
        </p>

        {/* --- start over --- */}
        <p className="eyebrow eyebrow--danger">Start over</p>
        <div className="editor-block editor-block--danger">
          <p className="field__hint">
            Erase everything on this device — the household, this week's plan, the
            shopping list, saved recipes and all history — and go back to the welcome
            screen. This can't be undone.
          </p>
          <button className="btn btn--danger" onClick={onReset}>
            Reset everything
          </button>
        </div>
      </div>
    </Shell>
  );
}

/** "adult" → "Adult", for the collapsed summary row. */
function ageLabel(age: Person['ageBand']): string {
  return age.charAt(0).toUpperCase() + age.slice(1);
}
