/**
 * Undo stack tests. Separate from the engine suite because this is app state,
 * not domain logic — but it still runs headlessly.
 */
import { SEED_HOUSEHOLD } from '../src/core/data/household.js';
import { generatePlan } from '../src/core/planner/solver.js';
import { UndoStack } from '../src/store/undo.js';
import type { RuleContext } from '../src/core/rules/context.js';

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const ctx: RuleContext = { household: SEED_HOUSEHOLD, history: [] };
const planA = generatePlan(ctx, '2026-08-03', { seed: 1 }).plan;
const planB = generatePlan(ctx, '2026-08-03', { seed: 2 }).plan;

console.log('\nUndo stack');

const stack = new UndoStack();
check('starts empty', !stack.canUndo && !stack.canRedo);
check('undoing nothing is safe', stack.undo(SEED_HOUSEHOLD, planA) === null);

stack.push('retiring a dish', SEED_HOUSEHOLD, planA);
check('can undo after a push', stack.canUndo);
check('the label describes what would be reversed', stack.peek() === 'retiring a dish');

const restored = stack.undo(SEED_HOUSEHOLD, planB);
check('undo returns the earlier plan', restored?.plan?.seed === planA.seed);
check('and offers a redo', stack.canRedo);

const redone = stack.redo(SEED_HOUSEHOLD, planA);
check('redo returns the later plan', redone?.plan?.seed === planB.seed);
check('and there is something to undo again', stack.canUndo);

// The bug this guards against: a new action leaving a stale redo available,
// so "redo" jumps to a state that no longer follows from anything.
stack.undo(SEED_HOUSEHOLD, planB);
check('redo is available before a new action', stack.canRedo);
stack.push('a different change', SEED_HOUSEHOLD, planA);
check('a new action clears the redo branch', !stack.canRedo);

// Snapshots must be independent of the live objects they were taken from.
const mutable = structuredClone(SEED_HOUSEHOLD);
const fresh = new UndoStack();
fresh.push('before edit', mutable, planA);
mutable.people[0].name = 'Changed';
const snapshot = fresh.undo(mutable, planA);
check(
  'snapshots are deep copies, not references',
  snapshot?.household.people[0].name !== 'Changed',
  snapshot?.household.people[0].name,
);

// Depth is bounded so a long session can't grow without limit.
const deep = new UndoStack();
for (let i = 0; i < 40; i++) deep.push(`change ${i}`, SEED_HOUSEHOLD, planA);
check('depth is capped', deep.depth <= 20, `${deep.depth}`);
check('and the most recent change is still the one on top', deep.peek() === 'change 39');

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
