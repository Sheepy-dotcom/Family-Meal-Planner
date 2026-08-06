/**
 * The moment a rule is added, say what it does.
 *
 * A settings screen that lets you quietly make your own week impossible is a
 * settings screen people stop trusting. So every rule is run through the real
 * feasibility check the instant it's written: "this rules out 14 of 58 dinners",
 * or "no dinner can satisfy this and your Tuesday time budget". Nothing is saved
 * on the strength of a hopeful guess.
 */

import { allRecipes } from '../data/registry.js';
import { attendeesFor, DAYS, DAY_NAMES } from '../rules/context.js';
import type { RuleContext } from '../rules/context.js';
import { effectiveEnforcement, tagLabel } from '../rules/custom.js';
import { checkFeasibility } from './feasibility.js';
import type { CustomRule, MealSlot, Recipe } from '../types.js';

export interface RuleImpact {
  /** False only when the rule makes a slot impossible to fill. */
  ok: boolean;
  /** The headline sentence, in plain voice. */
  headline: string;
  /** Extra lines: the slots affected, or a capacity warning. */
  details: string[];
}

const SLOT_PLURAL: Record<MealSlot, string> = {
  breakfast: 'breakfasts',
  lunch: 'lunches',
  dinner: 'dinners',
  snack: 'snacks',
};
const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function ctxWithRule(ctx: RuleContext, rule: CustomRule): RuleContext {
  return {
    ...ctx,
    household: {
      ...ctx.household,
      customRules: [...(ctx.household.customRules ?? []), rule],
    },
  };
}

/** Friendlier names for a pre-existing binding rule in an interaction message. */
function bindingName(ruleId: string | null, label: string | null): string {
  if (ruleId === 'time-budget') return 'time budget';
  if (ruleId === 'dietary-exclusions') return 'dietary needs';
  return (label ?? 'rules').toLowerCase();
}

export function previewImpact(rule: CustomRule, ctx: RuleContext): RuleImpact {
  const before = checkFeasibility(ctx);
  const after = checkFeasibility(ctxWithRule(ctx, rule));

  // 1. Did it make anything impossible? This is the case worth stopping for.
  const wasImpossible = new Set(before.impossible.map((s) => `${s.day}:${s.slot}`));
  const newlyImpossible = after.impossible.filter(
    (s) => !wasImpossible.has(`${s.day}:${s.slot}`),
  );
  if (newlyImpossible.length > 0) {
    const s = newlyImpossible[0];
    const pre = before.slots.find((x) => x.day === s.day && x.slot === s.slot);
    const clash =
      pre && pre.bindingRuleId
        ? ` and your ${DAY_NAMES[s.day]} ${bindingName(pre.bindingRuleId, pre.bindingRuleLabel)}`
        : '';
    return {
      ok: false,
      headline: `No ${s.slot} can satisfy this${clash} — ${DAY_NAMES[s.day]} would have nothing to cook.`,
      details: newlyImpossible.map((x) => `${DAY_NAMES[x.day]} ${x.slot}: 0 dishes left`),
    };
  }

  // 2. Did it make anything so tight it will repeat week to week?
  const wasTight = new Map(before.slots.map((s) => [`${s.day}:${s.slot}`, s.eligible]));
  const newlyTight = after.slots.filter(
    (s) => s.eligible <= 2 && (wasTight.get(`${s.day}:${s.slot}`) ?? 99) > 2,
  );
  const tightNote = newlyTight.map(
    (s) => `${DAY_NAMES[s.day]} ${s.slot} is down to ${s.eligible} option${s.eligible === 1 ? '' : 's'} — expect repeats.`,
  );

  // 3. Otherwise, quantify it honestly by kind.
  if (effectiveEnforcement(rule) === 'hard') {
    return { ok: true, ...hardHeadline(rule, ctx), details: tightNote };
  }
  return { ok: true, headline: softHeadline(rule), details: [...softWarnings(rule, ctx), ...tightNote] };
}

// ---------------------------------------------------------------------------

function subjectMatch(recipe: Recipe, proteins: string[], tags: string[]): boolean {
  return proteins.some((p) => recipe.proteins.includes(p as never)) ||
    tags.some((t) => recipe.tags.includes(t as never));
}

function daySuffix(days: number[]): string {
  if (days.length === 0 || days.length === 7) return '';
  return ` on ${days.slice().sort((a, b) => a - b).map((d) => DAY_ABBR[d]).join('/')}`;
}

function hardHeadline(rule: CustomRule, ctx: RuleContext): { headline: string } {
  switch (rule.kind) {
    case 'avoid': {
      const slots = rule.slots.length ? rule.slots : ctx.household.plannedSlots;
      let best = { slot: slots[0] ?? ('dinner' as MealSlot), removed: 0, total: 0 };
      for (const slot of slots) {
        const forSlot = allRecipes().filter((r) => r.slots.includes(slot));
        const removed = forSlot.filter((r) =>
          subjectMatch(r, rule.proteins ?? [], rule.tags ?? []),
        ).length;
        if (removed > best.removed) best = { slot, removed, total: forSlot.length };
        else if (best.total === 0) best = { slot, removed, total: forSlot.length };
      }
      return {
        headline: `This rules out ${best.removed} of ${best.total} ${SLOT_PLURAL[best.slot]}${daySuffix(rule.days)}.`,
      };
    }
    case 'tag-count':
      return { headline: `Caps ${tagLabel(rule.tag)} at ${rule.count} a week — anything beyond that won't be planned.` };
    case 'no-consecutive': {
      const what = rule.by === 'cuisine' ? 'the same cuisine' : `${rule.tag ?? 'these'} dishes`;
      return { headline: `Stops ${what} landing two days running.` };
    }
    default:
      return { headline: 'Added.' };
  }
}

function softHeadline(rule: CustomRule): string {
  const w = rule.weight ?? 2;
  return `Soft goal (weight ${w}): the planner will lean this way, never blocked, and flag it if a week falls short.`;
}

/** Capacity sanity checks — is the soft target even reachable? */
function softWarnings(rule: CustomRule, ctx: RuleContext): string[] {
  if (rule.kind === 'person-protein') {
    const person = ctx.household.people.find((p) => p.id === rule.personId);
    let attended = 0;
    for (const day of DAYS) {
      for (const slot of ctx.household.plannedSlots) {
        if (attendeesFor(ctx.household, day, slot).some((p) => p.id === rule.personId)) attended++;
      }
    }
    if (rule.minPerWeek > attended) {
      return [
        `${person?.name ?? 'They'} only sit down to ${attended} planned meal${attended === 1 ? '' : 's'} at home a week, so ${rule.minPerWeek}× can't be met.`,
      ];
    }
  }
  return [];
}
