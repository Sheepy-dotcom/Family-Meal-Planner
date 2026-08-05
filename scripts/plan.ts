/**
 * `npm run plan` — generate a week and print it.
 * Useful for eyeballing the solver's output without booting the UI.
 */
import { SEED_HOUSEHOLD } from '../src/core/data/household.js';
import { getRecipe } from '../src/core/data/registry.js';
import { generatePlan } from '../src/core/planner/solver.js';
import { DAY_NAMES, type RuleContext } from '../src/core/rules/index.js';
import { buildShoppingList } from '../src/core/shopping/list.js';
import { flagShoppingList } from '../src/core/diet/screen.js';
import { manualExportAdapter } from '../src/core/basket/manual.js';

const seed = Number(process.argv[2] ?? 42);
const ctx: RuleContext = { household: SEED_HOUSEHOLD, history: [] };

const started = Date.now();
const { plan, evaluation, unfilled } = generatePlan(ctx, '2026-08-03', { seed });
const elapsed = Date.now() - started;

console.log(`\n  WEEK OF 3 AUGUST  ·  seed ${seed}  ·  solved in ${elapsed}ms\n`);

for (let day = 0; day < 7; day++) {
  const meals = plan.meals.filter((m) => m.day === day);
  if (meals.length === 0) continue;
  console.log(`  ${DAY_NAMES[day].toUpperCase()}`);
  for (const meal of meals) {
    const recipe = getRecipe(meal.recipeId);
    const badges = [
      recipe.isNew ? 'new' : null,
      meal.attendeeIds.length < SEED_HOUSEHOLD.people.length
        ? `${meal.attendeeIds.length} eating`
        : null,
      !meal.attendeeIds.some(
        (id) => SEED_HOUSEHOLD.people.find((p) => p.id === id)?.ageBand === 'adult',
      )
        ? 'kids only'
        : null,
    ].filter(Boolean);
    console.log(
      `    ${meal.slot.padEnd(10)} ${recipe.name}` +
        `\n    ${' '.repeat(10)} ${recipe.cuisine} · ${recipe.activeMinutes} min hands-on · ${meal.portions} portions` +
        (badges.length ? ` · ${badges.join(' · ')}` : ''),
    );
  }
  console.log('');
}

console.log(`  RULES  (overall ${Math.round(evaluation.totalScore * 100)}%)\n`);
for (const rule of evaluation.soft) {
  const mark = rule.status === 'met' ? 'ok  ' : rule.status === 'partial' ? 'part' : 'MISS';
  console.log(`    ${mark}  ${rule.label.padEnd(42)} ${rule.detail}`);
}

if (evaluation.violations.length > 0) {
  console.log('\n  HARD VIOLATIONS');
  for (const v of evaluation.violations) console.log(`    ${v.message}`);
}

if (unfilled.length > 0) {
  console.log('\n  UNFILLED SLOTS');
  for (const u of unfilled) console.log(`    ${u.reason}`);
}

const list = buildShoppingList(plan);
const flagged = flagShoppingList(list, SEED_HOUSEHOLD);
const exported = await manualExportAdapter.send(list, flagged);

console.log('\n  SHOPPING LIST\n');
console.log(
  exported.text
    .split('\n')
    .map((l) => `  ${l}`)
    .join('\n'),
);
console.log(`\n  ${exported.message}\n`);
