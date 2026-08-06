/**
 * Cross-device sync tests.
 *
 * The network is thin and stubbed here; what's worth testing is the code
 * handling (generation and forgiving normalisation) and the storage snapshot
 * round-trip — the two places a bug would silently corrupt or leak a
 * household's state.
 */
import { generateCode, normaliseCode, CODE_RE, pull, push } from '../src/store/sync.js';
import { exportState, applyState } from '../src/store/persist.js';
import { writeRaw, readRaw } from '../src/store/storage.js';

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

console.log('\nCross-device sync');

// --- codes ----------------------------------------------------------------
check('a generated code matches the format', CODE_RE.test(generateCode()));
check('generated codes vary', generateCode() !== generateCode());
check('no ambiguous characters are ever generated', /^MEAL-[2-9A-HJ-NP-Z]{5}$/.test(generateCode()));

check('a bare body is accepted', normaliseCode('abcde') === 'MEAL-ABCDE');
check('the full code is accepted', normaliseCode('MEAL-ABCDE') === 'MEAL-ABCDE');
check('lower case is accepted', normaliseCode('meal-abcde') === 'MEAL-ABCDE');
check('spaces are forgiven', normaliseCode('  ab cde ') === 'MEAL-ABCDE');
check('too short is rejected', normaliseCode('ABCD') === null);
check('ambiguous letters are rejected', normaliseCode('ABCDI') === null);
check('a zero is rejected', normaliseCode('ABCD0') === null);
check('empty is rejected', normaliseCode('') === null);

// --- storage snapshot round-trip -----------------------------------------
{
  writeRaw('mp.household.v1', '{"name":"Test"}');
  writeRaw('mp.plan.v1', '{"weekStartISO":"2026-08-03"}');
  writeRaw('mp.session.v1', 'device-local'); // not syncable

  const blob = exportState();
  check('export includes syncable keys', blob['mp.household.v1'] === '{"name":"Test"}' && blob['mp.plan.v1'] !== undefined);
  check('export excludes the device session id', blob['mp.session.v1'] === undefined);

  // Adopt a snapshot that has a household but no plan: plan must clear so the
  // two devices match exactly.
  applyState({ 'mp.household.v1': '{"name":"Shared"}' });
  check('apply overwrites a present key', readRaw('mp.household.v1') === '{"name":"Shared"}');
  check('apply clears a key the snapshot omits', readRaw('mp.plan.v1') === null);
  check('apply never touches the session id', readRaw('mp.session.v1') === 'device-local');

  // A hostile blob can't plant arbitrary keys.
  applyState({ 'mp.evil.v1': 'nope', 'mp.household.v1': '{"name":"Ok"}' } as Record<string, unknown>);
  check('apply ignores unknown keys', readRaw('mp.evil.v1') === null);
}

// --- network shapes (stubbed) --------------------------------------------
async function run() {
  const notFound = { status: 404, ok: false, json: async () => ({}) } as unknown as Response;
  const okGet = { status: 200, ok: true, json: async () => ({ version: 3, blob: { a: '1' } }) } as unknown as Response;
  const okPut = { status: 200, ok: true, json: async () => ({ version: 4 }) } as unknown as Response;
  const conflict = { status: 409, ok: false, json: async () => ({ version: 9, blob: { b: '2' } }) } as unknown as Response;

  check('pull returns null for an unknown code', (await pull('MEAL-ABCDE', async () => notFound)) === null);
  const got = await pull('MEAL-ABCDE', async () => okGet);
  check('pull returns the remote state', got?.version === 3 && got?.blob.a === '1');

  const pushed = await push('MEAL-ABCDE', { a: '1' }, 3, async () => okPut);
  check('push reports the new version', 'ok' in pushed && pushed.version === 4);

  const clash = await push('MEAL-ABCDE', { a: '1' }, 1, async () => conflict);
  check('push surfaces a conflict with the server state', 'conflict' in clash && clash.current.version === 9);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}
run();
