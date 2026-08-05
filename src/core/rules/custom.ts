/**
 * Household-authored rules, compiled into the built-in interfaces.
 *
 * The whole point of this module is that its output is ordinary: an AvoidRule
 * marked hard becomes a HardRule indistinguishable from noFishAtWeekendDinners,
 * and a soft one becomes a SoftRule alongside fishFrequency. The solver,
 * feasibility check and explain feature never learn that a rule was authored by
 * a user — they just see more rules.
 *
 * This is deliberately a small, closed set, not a rule language. Four shapes
 * cover the real household rules ("no fish at weekends", "Jack gets red meat
 * weekly", "at most two traybakes", "no two curries running"); anything more
 * general would be a scripting surface nobody asked for.
 */

import { getRecipe } from '../data/registry.js';
import { DAY_NAMES } from './context.js';
import type { RuleContext } from './context.js';
import type {
  AvoidRule,
  CustomRule,
  DayIndex,
  Enforcement,
  MealSlot,
  NoConsecutiveRule,
  PersonProteinRule,
  ProteinClass,
  Recipe,
  RecipeTag,
  TagCountRule,
} from '../types.js';
import type { HardRule } from './hard.js';
import type { SoftRule } from './soft.js';

// ---------------------------------------------------------------------------
// Which enforcements each shape can actually express
// ---------------------------------------------------------------------------

/**
 * A hard rule is a per-dish veto. That can express "never serve X" and "at most
 * N" (block once the cap is hit), but not a weekly *minimum* — refusing dishes
 * never raises a count. So minimums are soft-only, and the UI is told as much.
 */
export function supportsHard(rule: CustomRule): boolean {
  switch (rule.kind) {
    case 'avoid':
    case 'no-consecutive':
      return true;
    case 'tag-count':
      return rule.bound === 'at-most';
    case 'person-protein':
      return false;
  }
}

export function availableEnforcements(rule: CustomRule): Enforcement[] {
  return supportsHard(rule) ? ['hard', 'soft'] : ['soft'];
}

/** The enforcement actually used, clamping an unsupported "hard" to soft. */
export function effectiveEnforcement(rule: CustomRule): Enforcement {
  return rule.enforcement === 'hard' && supportsHard(rule) ? 'hard' : 'soft';
}

const DEFAULT_SOFT_WEIGHT = 2;
function weightOf(rule: CustomRule): number {
  return rule.weight ?? DEFAULT_SOFT_WEIGHT;
}

// ---------------------------------------------------------------------------
// Compilation
// ---------------------------------------------------------------------------

export function compileHardRules(rules: CustomRule[]): HardRule[] {
  return rules
    .filter((r) => effectiveEnforcement(r) === 'hard')
    .map(toHardRule)
    .filter((r): r is HardRule => r !== null);
}

export function compileSoftRules(rules: CustomRule[]): SoftRule[] {
  return rules
    .filter((r) => effectiveEnforcement(r) === 'soft')
    .map(toSoftRule)
    .filter((r): r is SoftRule => r !== null);
}

function idFor(rule: CustomRule): string {
  return `custom:${rule.id}`;
}

function toHardRule(rule: CustomRule): HardRule | null {
  switch (rule.kind) {
    case 'avoid':
      return avoidHard(rule);
    case 'tag-count':
      return rule.bound === 'at-most' ? tagMaxHard(rule) : null;
    case 'no-consecutive':
      return noConsecutiveHard(rule);
    case 'person-protein':
      return null; // a minimum can't be a veto
  }
}

function toSoftRule(rule: CustomRule): SoftRule | null {
  switch (rule.kind) {
    case 'avoid':
      return avoidSoft(rule);
    case 'tag-count':
      return tagCountSoft(rule);
    case 'no-consecutive':
      return noConsecutiveSoft(rule);
    case 'person-protein':
      return personProteinSoft(rule);
  }
}

// --- avoid ---------------------------------------------------------------

/** Does a dish match the avoid subject (any listed protein or tag)? */
function avoidMatches(rule: AvoidRule, recipe: Recipe): boolean {
  const byProtein = (rule.proteins ?? []).some((p) => recipe.proteins.includes(p));
  const byTag = (rule.tags ?? []).some((t) => recipe.tags.includes(t));
  return byProtein || byTag;
}

function avoidAppliesTo(rule: AvoidRule, day: DayIndex, slot: MealSlot): boolean {
  const dayOk = rule.days.length === 0 || rule.days.includes(day);
  const slotOk = rule.slots.length === 0 || rule.slots.includes(slot);
  return dayOk && slotOk;
}

function avoidHard(rule: AvoidRule): HardRule {
  const subject = subjectLabel(rule);
  const when = whenLabel(rule.days, rule.slots);
  return {
    id: idFor(rule),
    label: `No ${subject} ${when}`,
    // A food-based ban still holds for a reheated planned-over.
    appliesToPlannedOvers: true,
    allows: (recipe, day, slot) =>
      !(avoidAppliesTo(rule, day, slot) && avoidMatches(rule, recipe)),
    explain: (recipe, day, slot) =>
      `${recipe.name} is ${subject}, and you've said no ${subject} on ${DAY_NAMES[day]} ${slot}`,
    constraintClause: (day, slot) =>
      avoidAppliesTo(rule, day, slot) ? `${subject} is off the menu ${when}` : null,
  };
}

function avoidSoft(rule: AvoidRule): SoftRule {
  const subject = subjectLabel(rule);
  const when = whenLabel(rule.days, rule.slots);
  return {
    id: idFor(rule),
    label: `Go easy on ${subject} ${when}`,
    weight: weightOf(rule),
    evaluate: (meals) => {
      const hits = meals.filter(
        (m) => avoidAppliesTo(rule, m.day, m.slot) && avoidMatches(rule, getRecipe(m.recipeId)),
      ).length;
      const score = hits === 0 ? 1 : Math.max(0, 1 - hits * 0.34);
      return {
        score,
        status: statusFor(score),
        detail: hits === 0 ? `No ${subject} ${when}` : `${subject} served ${hits}×`,
      };
    },
  };
}

// --- tag counts ----------------------------------------------------------

function tagMaxHard(rule: TagCountRule): HardRule {
  const noun = tagLabel(rule.tag);
  return {
    id: idFor(rule),
    label: `At most ${rule.count} ${noun} a week`,
    // A planned-over isn't a fresh cook, so it doesn't count against the cap.
    appliesToPlannedOvers: false,
    allows: (recipe, _day, _slot, _ctx, placed) => {
      if (!recipe.tags.includes(rule.tag)) return true;
      const already = (placed ?? []).filter(
        (m) => m.source !== 'planned-over' && getRecipe(m.recipeId).tags.includes(rule.tag),
      ).length;
      return already < rule.count;
    },
    explain: (recipe) => `${recipe.name} is a ${singularTag(rule.tag)} dish, and you cap ${noun} at ${rule.count} a week`,
  };
}

function tagCountSoft(rule: TagCountRule): SoftRule {
  const noun = tagLabel(rule.tag);
  const atLeast = rule.bound === 'at-least';
  return {
    id: idFor(rule),
    label: `${atLeast ? 'At least' : 'At most'} ${rule.count} ${noun} a week`,
    weight: weightOf(rule),
    evaluate: (meals) => {
      const count = meals.filter((m) => getRecipe(m.recipeId).tags.includes(rule.tag)).length;
      let score: number;
      if (atLeast) {
        score = count >= rule.count ? 1 : rule.count === 0 ? 1 : count / rule.count;
      } else {
        const over = Math.max(0, count - rule.count);
        score = over === 0 ? 1 : Math.max(0, 1 - over * 0.25);
      }
      return { score, status: statusFor(score), detail: `${count} ${noun} (want ${atLeast ? '≥' : '≤'} ${rule.count})` };
    },
  };
}

// --- person protein ------------------------------------------------------

function personProteinSoft(rule: PersonProteinRule): SoftRule {
  const proteins = rule.proteins.map(proteinLabel).join(' or ');
  return {
    id: idFor(rule),
    label: `A person gets ${proteins} ${rule.minPerWeek}× a week`,
    weight: weightOf(rule),
    evaluate: (meals, ctx) => {
      const person = ctx.household.people.find((p) => p.id === rule.personId);
      const count = meals.filter(
        (m) =>
          m.attendeeIds.includes(rule.personId) &&
          getRecipe(m.recipeId).proteins.some((p) => rule.proteins.includes(p)),
      ).length;
      const score = count >= rule.minPerWeek ? 1 : rule.minPerWeek === 0 ? 1 : count / rule.minPerWeek;
      return {
        score,
        status: statusFor(score),
        detail: `${person?.name ?? 'They'}: ${count}/${rule.minPerWeek} ${proteins}`,
      };
    },
  };
}

// --- no consecutive ------------------------------------------------------

function consecutiveClash(rule: NoConsecutiveRule, a: Recipe, b: Recipe): boolean {
  if (rule.by === 'cuisine') return a.cuisine === b.cuisine;
  return !!rule.tag && a.tags.includes(rule.tag) && b.tags.includes(rule.tag);
}

function noConsecutiveHard(rule: NoConsecutiveRule): HardRule {
  const chainSlot = rule.slot ?? 'dinner';
  const what = rule.by === 'cuisine' ? 'cuisine' : singularTag(rule.tag ?? 'salad');
  return {
    id: idFor(rule),
    label: `No ${what} two days running`,
    // A variety rule about the run of cooking; a reheat doesn't extend it.
    appliesToPlannedOvers: false,
    allows: (recipe, day, slot, _ctx, placed) => {
      if (slot !== chainSlot || !placed) return true;
      const neighbours = placed.filter(
        (m) => m.slot === chainSlot && Math.abs(m.day - day) === 1,
      );
      return !neighbours.some((n) => consecutiveClash(rule, getRecipe(n.recipeId), recipe));
    },
    explain: (recipe) =>
      `${recipe.name} would repeat the ${rule.by === 'cuisine' ? `${recipe.cuisine} cuisine` : what} from the day before`,
  };
}

function noConsecutiveSoft(rule: NoConsecutiveRule): SoftRule {
  const chainSlot = rule.slot ?? 'dinner';
  const what = rule.by === 'cuisine' ? 'cuisine' : singularTag(rule.tag ?? 'salad');
  return {
    id: idFor(rule),
    label: `Avoid ${what} two days running`,
    weight: weightOf(rule),
    evaluate: (meals) => {
      const run = meals
        .filter((m) => m.slot === chainSlot)
        .sort((a, b) => a.day - b.day);
      if (run.length < 2) return { score: 1, status: 'met' as const, detail: 'Too few to clash' };
      let clashes = 0;
      for (let i = 1; i < run.length; i++) {
        if (run[i].day !== run[i - 1].day + 1) continue;
        if (consecutiveClash(rule, getRecipe(run[i - 1].recipeId), getRecipe(run[i].recipeId))) {
          clashes++;
        }
      }
      const score = 1 - clashes / (run.length - 1);
      return {
        score,
        status: statusFor(score),
        detail: clashes === 0 ? 'No back-to-back repeats' : `${clashes} back-to-back`,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Human-readable descriptions (for the rules screen)
// ---------------------------------------------------------------------------

/** One line summarising what a rule does, in the app's plain voice. */
export function describeRule(rule: CustomRule, ctx?: RuleContext): string {
  const hard = effectiveEnforcement(rule) === 'hard';
  switch (rule.kind) {
    case 'avoid': {
      const verb = hard ? 'Never serve' : 'Rarely serve';
      return `${verb} ${subjectLabel(rule)} ${whenLabel(rule.days, rule.slots)}`;
    }
    case 'person-protein': {
      const name = ctx?.household.people.find((p) => p.id === rule.personId)?.name ?? 'They';
      return `${name} gets ${rule.proteins.map(proteinLabel).join(' or ')} at least ${rule.minPerWeek}× a week`;
    }
    case 'tag-count':
      return `${rule.bound === 'at-least' ? 'At least' : 'At most'} ${rule.count} ${tagLabel(rule.tag)} a week`;
    case 'no-consecutive': {
      const what = rule.by === 'cuisine' ? 'cuisine' : singularTag(rule.tag ?? 'salad');
      return `Never two ${what === 'cuisine' ? 'meals of the same cuisine' : `${what} dishes`} in a row`;
    }
  }
}

/** The plain-terms difference between hard and soft, for the chosen mode. */
export function enforcementBlurb(enforcement: Enforcement): string {
  return enforcement === 'hard'
    ? 'Hard: a dish that breaks this is never planned. It can make a week impossible, so we check as you add it.'
    : 'Soft: a weighted preference. The planner leans this way but can fall short — and always tells you when it does.';
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

function statusFor(score: number): 'met' | 'partial' | 'unmet' {
  if (score >= 0.999) return 'met';
  if (score >= 0.5) return 'partial';
  return 'unmet';
}

const PROTEIN_LABEL: Record<ProteinClass, string> = {
  fish: 'fish',
  shellfish: 'shellfish',
  chicken: 'chicken',
  'red-meat': 'red meat',
  pork: 'pork',
  egg: 'eggs',
  legume: 'beans & pulses',
  'dairy-protein': 'dairy',
  'meat-substitute': 'meat-free protein',
  none: 'no protein',
};
export function proteinLabel(p: ProteinClass): string {
  return PROTEIN_LABEL[p] ?? p;
}

const TAG_PLURAL: Partial<Record<RecipeTag, string>> = {
  traybake: 'traybakes',
  salad: 'salads',
  pasta: 'pasta meals',
  soup: 'soups',
  curry: 'curries',
  'stir-fry': 'stir-fries',
  roast: 'roasts',
  sandwich: 'sandwiches',
  grill: 'grills',
  'one-pot': 'one-pot meals',
  'batch-cooks': 'batch cooks',
  'kid-easy': 'kid-easy meals',
  'make-ahead': 'make-ahead meals',
  'no-cook': 'no-cook meals',
  sweet: 'sweet dishes',
};
export function tagLabel(t: RecipeTag): string {
  return TAG_PLURAL[t] ?? `${t} dishes`;
}
function singularTag(t: RecipeTag): string {
  return t;
}

/** "fish", "traybakes", "fish or traybakes". */
function subjectLabel(rule: AvoidRule): string {
  const parts = [
    ...(rule.proteins ?? []).map(proteinLabel),
    ...(rule.tags ?? []).map(tagLabel),
  ];
  if (parts.length === 0) return 'anything';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}`;
}

const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "on Fri/Sat/Sun dinner", "at dinner", "any day". */
function whenLabel(days: DayIndex[], slots: MealSlot[]): string {
  const dayPart =
    days.length === 0 || days.length === 7
      ? ''
      : `on ${days.slice().sort((a, b) => a - b).map((d) => DAY_ABBR[d]).join('/')}`;
  const slotPart = slots.length === 0 ? '' : `at ${slots.join('/')}`;
  const joined = [dayPart, slotPart].filter(Boolean).join(' ');
  return joined || 'any day';
}
