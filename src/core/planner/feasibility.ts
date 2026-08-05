import { allRecipes } from '../data/registry.js';
import { DAYS, DAY_NAMES, attendeesFor, type RuleContext } from '../rules/context.js';
import { HARD_RULES } from '../rules/hard.js';
import type { DayIndex, MealSlot, Recipe } from '../types.js';

/**
 * Can this household's rules actually be satisfied?
 *
 * The solver already reports slots it couldn't fill, but that's after the fact
 * — you've pressed Plan and got a week with a hole in it. This runs *before*
 * generating, so tightening a time budget or adding an exclusion tells you
 * straight away what it costs. A settings screen that lets you silently make
 * your own week impossible is a settings screen people stop trusting.
 */

export type Pressure = 'comfortable' | 'tight' | 'impossible';

export interface SlotFeasibility {
  day: DayIndex;
  slot: MealSlot;
  /** Dishes passing every dish-level hard rule for this slot. */
  eligible: number;
  pressure: Pressure;
  /**
   * Which rule removed the most options. This is the one to relax, and naming
   * it is the difference between "no meals fit" and an actionable answer.
   */
  bindingRuleId: string | null;
  bindingRuleLabel: string | null;
  message: string;
}

export interface FeasibilityReport {
  slots: SlotFeasibility[];
  /** Slots that cannot be filled at all. */
  impossible: SlotFeasibility[];
  /** Slots with so few options the week will repeat itself. */
  tight: SlotFeasibility[];
  ok: boolean;
}

/**
 * Rules are evaluated one-out: for each rule, count how many dishes it alone
 * removes. The rule removing the most is the one worth telling the user about.
 * Dropping a whole rule and re-counting is more honest than guessing from the
 * rule's name what it probably did.
 */
function analyseSlot(
  day: DayIndex,
  slot: MealSlot,
  ctx: RuleContext,
): SlotFeasibility {
  const forSlot = allRecipes().filter((r) => r.slots.includes(slot));
  const passes = (recipe: Recipe, skipRuleId?: string) =>
    HARD_RULES.every(
      (rule) => rule.id === skipRuleId || rule.allows(recipe, day, slot, ctx),
    );

  const eligible = forSlot.filter((r) => passes(r)).length;

  let bindingRuleId: string | null = null;
  let bindingRuleLabel: string | null = null;
  let bestGain = 0;

  if (eligible < forSlot.length) {
    for (const rule of HARD_RULES) {
      if (rule.id === 'slot-fit' || rule.id === 'repeat-limit') continue;
      const withoutRule = forSlot.filter((r) => passes(r, rule.id)).length;
      const gain = withoutRule - eligible;
      if (gain > bestGain) {
        bestGain = gain;
        bindingRuleId = rule.id;
        bindingRuleLabel = rule.label;
      }
    }
  }

  const pressure: Pressure =
    eligible === 0 ? 'impossible' : eligible <= 2 ? 'tight' : 'comfortable';

  const where = `${DAY_NAMES[day]} ${slot}`;
  let message: string;
  if (pressure === 'impossible') {
    message = bindingRuleLabel
      ? `Nothing fits ${where}. "${bindingRuleLabel}" is ruling out ${bestGain} dish${bestGain === 1 ? '' : 'es'} on its own — relax that, or add a recipe.`
      : `Nothing in the recipe book fits ${where}.`;
  } else if (pressure === 'tight') {
    message = bindingRuleLabel
      ? `Only ${eligible} dish${eligible === 1 ? '' : 'es'} fit ${where}, so it'll repeat week to week. "${bindingRuleLabel}" is the tightest constraint here.`
      : `Only ${eligible} dish${eligible === 1 ? '' : 'es'} fit ${where}.`;
  } else {
    message = `${eligible} dishes fit ${where}.`;
  }

  return { day, slot, eligible, pressure, bindingRuleId, bindingRuleLabel, message };
}

export function checkFeasibility(ctx: RuleContext): FeasibilityReport {
  const slots: SlotFeasibility[] = [];

  for (const day of DAYS) {
    for (const slot of ctx.household.plannedSlots) {
      if (attendeesFor(ctx.household, day, slot).length === 0) continue;
      slots.push(analyseSlot(day, slot, ctx));
    }
  }

  const impossible = slots.filter((s) => s.pressure === 'impossible');
  const tight = slots.filter((s) => s.pressure === 'tight');

  return { slots, impossible, tight, ok: impossible.length === 0 };
}

/**
 * Whether the recipe book can supply enough distinct dishes for a slot type
 * across a week. Catches the failure the per-slot check misses: seven Mondays'
 * worth of options is no good if they're all the same three dishes.
 */
export function checkVariety(ctx: RuleContext): string[] {
  const warnings: string[] = [];

  for (const slot of ctx.household.plannedSlots) {
    const days = DAYS.filter(
      (day) => attendeesFor(ctx.household, day, slot).length > 0,
    );
    if (days.length === 0) continue;

    const usable = new Set<string>();
    for (const day of days) {
      for (const recipe of allRecipes()) {
        if (!recipe.slots.includes(slot)) continue;
        if (HARD_RULES.every((rule) => rule.allows(recipe, day, slot, ctx))) {
          usable.add(recipe.id);
        }
      }
    }

    // Dinners can't repeat at all; breakfast and lunch may appear twice.
    const maxUses = slot === 'dinner' ? 1 : 2;
    const capacity = usable.size * maxUses;
    if (capacity < days.length) {
      warnings.push(
        `${days.length} ${slot}s to fill but only ${usable.size} suitable dish${usable.size === 1 ? '' : 'es'} — ` +
          `that covers ${capacity}. Add ${Math.ceil((days.length - capacity) / maxUses)} more, or relax a rule.`,
      );
    }
  }

  return warnings;
}
