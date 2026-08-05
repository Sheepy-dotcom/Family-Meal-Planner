/**
 * Why is *this* dish here?
 *
 * A plan is the residue of its constraints: every meal survived because some
 * rules allowed it and others cut everything else away. This turns that back
 * into a sentence — not a guess at the solver's mood, but the constraints that
 * demonstrably narrowed the field for that slot.
 *
 * The method is feasibility.ts's, applied to one placed meal: count the dishes
 * eligible for the slot, then drop each hard rule one at a time and see how many
 * it alone was removing. The rule that removed the most is the one worth naming.
 * If nothing removed much, the honest answer is "nothing forced this" — said
 * plainly, never dressed up into a reason that wasn't there.
 */

import { allRecipes, getRecipe } from '../data/registry.js';
import { DAY_NAMES, allergensIn, attendeesFor } from '../rules/context.js';
import type { RuleContext } from '../rules/context.js';
import { HARD_RULES } from '../rules/hard.js';
import type {
  DayIndex,
  MealPlan,
  MealSlot,
  PlannedMeal,
  ProteinClass,
  Recipe,
} from '../types.js';

export interface BindingRule {
  ruleId: string;
  label: string;
  /** Dishes this rule alone was removing from the slot. */
  removed: number;
}

export interface MealExplanation {
  day: DayIndex;
  slot: MealSlot;
  /** Dishes the recipe book offers for this slot at all. */
  total: number;
  /** Dishes that pass every hard rule — what the choice was actually made from. */
  eligible: number;
  /** Hard rules that genuinely narrowed the slot, most-cutting first. */
  binding: BindingRule[];
  /** The one plain sentence for the UI. */
  sentence: string;
}

/**
 * Rules skipped in the one-out, matching feasibility.ts: slot-fit is already
 * applied by only considering slot-suitable dishes, and the repeat limit is a
 * property of the week being built, not of this dish in isolation.
 */
const SKIP = new Set(['slot-fit', 'repeat-limit']);

export function explainMeal(
  meal: PlannedMeal,
  plan: MealPlan,
  ctx: RuleContext,
): MealExplanation {
  const { day, slot } = meal;
  const recipe = getRecipe(meal.recipeId);
  const where = DAY_NAMES[day];

  // A planned-over isn't chosen against the slot's constraints — it's here
  // because it was already cooked. That's the whole reason; say it and stop.
  if (meal.source === 'planned-over' && meal.cookedOn) {
    return {
      day,
      slot,
      total: 0,
      eligible: 0,
      binding: [],
      sentence: `${where}: it's ${DAY_NAMES[meal.cookedOn.day]}'s ${recipe.name} again — cooked once, eaten twice.`,
    };
  }

  const forSlot = allRecipes().filter((r) => r.slots.includes(slot));
  const total = forSlot.length;
  const passes = (r: Recipe, skip?: string) =>
    HARD_RULES.every((rule) => rule.id === skip || rule.allows(r, day, slot, ctx));
  const eligible = forSlot.filter((r) => passes(r)).length;

  const binding: BindingRule[] = [];
  for (const rule of HARD_RULES) {
    if (SKIP.has(rule.id)) continue;
    const without = forSlot.filter((r) => passes(r, rule.id)).length;
    const removed = without - eligible;
    if (removed > 0) binding.push({ ruleId: rule.id, label: rule.label, removed });
  }
  // Array.sort is stable, so ties keep HARD_RULES order — the same tie-break
  // feasibility's sequential scan produces.
  binding.sort((a, b) => b.removed - a.removed);

  // Turn the top cutters into clauses. Only rules that describe a property of
  // the dish are surfaced; a couple (retired dishes, the week's avoid list)
  // remove options without saying anything about what got chosen.
  const clauses: string[] = [];
  const props: string[] = [];
  for (const b of binding) {
    if (clauses.length >= 2) break;
    const phrase = phraseFor(b.ruleId, day, slot, forSlot, ctx);
    if (!phrase) continue;
    clauses.push(phrase.clause);
    if (phrase.prop) props.push(phrase.prop);
  }

  // A weekly protein request that this dish was load-bearing for. Only added
  // when the sentence still has room, so it stays one sentence.
  const due = clauses.length <= 1 ? dueRequest(meal, recipe, plan, ctx) : null;

  return { day, slot, total, eligible, binding, sentence: assemble(where, clauses, props, due) };
}

interface Phrase {
  /** The constraint, e.g. "Katie can't have gluten". */
  clause: string;
  /** What it made the dish, e.g. "gluten-free". Optional. */
  prop?: string;
}

function phraseFor(
  ruleId: string,
  day: DayIndex,
  slot: MealSlot,
  forSlot: Recipe[],
  ctx: RuleContext,
): Phrase | null {
  switch (ruleId) {
    case 'time-budget': {
      const budget = ctx.household.timeBudgets.find(
        (b) => b.day === day && b.slot === slot,
      );
      if (!budget) return null;
      return { clause: `there's only ${budget.maxActiveMinutes} minutes on the hob`, prop: 'quick' };
    }
    case 'dietary-exclusions': {
      const present = attendeesFor(ctx.household, day, slot);
      // Only allergens that actually appear in slot dishes — i.e. genuinely cut
      // options — and only up to two, so the sentence stays short.
      const seen = new Set<string>();
      const facts: { allergen: string; names: string[] }[] = [];
      for (const person of present) {
        for (const allergen of person.dietary.avoidAllergens) {
          if (seen.has(allergen)) continue;
          if (!forSlot.some((r) => allergensIn(r).has(allergen))) continue;
          seen.add(allergen);
          const names = present
            .filter((p) => p.dietary.avoidAllergens.includes(allergen))
            .map((p) => p.name);
          facts.push({ allergen, names });
        }
      }
      if (facts.length === 0) return null;
      const chosen = facts.slice(0, 2);
      return {
        clause: chosen.map((f) => `${joinAnd(f.names)} can't have ${f.allergen}`).join(' and '),
        prop: joinAnd(chosen.map((f) => `${f.allergen}-free`)),
      };
    }
    case 'no-weekend-fish':
      return { clause: 'fish is off the menu at weekends' };
    case 'kids-alone-easy':
      return { clause: "no adult's eating", prop: 'one the kids can manage' };
    default:
      // blocked-dishes, weekly-avoid: real narrowing, but nothing about the
      // dish that got picked, so they don't earn a clause.
      return null;
  }
}

const PROTEIN_WORD: Record<ProteinClass, string> = {
  fish: 'fish',
  shellfish: 'shellfish',
  chicken: 'chicken',
  'red-meat': 'red meat',
  pork: 'pork',
  egg: 'eggs',
  legume: 'beans',
  'dairy-protein': 'dairy',
  'meat-substitute': 'a meat-free main',
  none: 'protein',
};

/**
 * A weekly protein request this meal is carrying. "Due" means every meal in the
 * plan that satisfies the request is needed to meet it — no slack — so this one
 * genuinely had to be what it is, rather than being one of several.
 */
function dueRequest(
  meal: PlannedMeal,
  recipe: Recipe,
  plan: MealPlan,
  ctx: RuleContext,
): string | null {
  for (const req of ctx.household.weeklyProteinRequests ?? []) {
    if (!meal.attendeeIds.includes(req.personId)) continue;
    if (!recipe.proteins.some((p) => req.proteins.includes(p))) continue;

    const satisfying = plan.meals.filter((m) => {
      const r = getRecipe(m.recipeId);
      return m.attendeeIds.includes(req.personId) && r.proteins.some((p) => req.proteins.includes(p));
    }).length;
    if (satisfying > req.minPerWeek) continue; // there's slack; this one wasn't forced

    const person = ctx.household.people.find((p) => p.id === req.personId);
    if (!person) continue;
    return `${person.name}'s ${PROTEIN_WORD[req.proteins[0]] ?? 'protein'} was due`;
  }
  return null;
}

function assemble(where: string, clauses: string[], props: string[], due: string | null): string {
  if (clauses.length === 0 && !due) {
    return `${where}: plenty of dishes fit here, so nothing really forced this one — a free pick.`;
  }
  const parts: string[] = [];
  if (clauses.length > 0) {
    let core = joinAnd(clauses);
    if (props.length > 0) core += `, so this is ${joinAnd(props)}`;
    parts.push(core);
  }
  if (due) parts.push(due);
  return `${where}: ${parts.join(', and ')}.`;
}

/** "a", "a and b", "a, b and c". */
function joinAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
