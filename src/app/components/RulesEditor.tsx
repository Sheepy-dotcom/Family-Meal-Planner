import { useMemo, useState } from 'react';
import type { RuleContext } from '../../core/rules/context.js';
import {
  availableEnforcements,
  describeRule,
  enforcementBlurb,
  proteinLabel,
  tagLabel,
} from '../../core/rules/custom.js';
import { previewImpact } from '../../core/planner/rulePreview.js';
import type {
  CustomRule,
  DayIndex,
  Enforcement,
  Household,
  MealSlot,
  ProteinClass,
  RecipeTag,
} from '../../core/types.js';

interface Props {
  household: Household;
  ctx: RuleContext;
  onChange: (next: Household) => void;
}

const KINDS: Array<{ id: CustomRule['kind']; label: string }> = [
  { id: 'avoid', label: 'Never / rarely serve…' },
  { id: 'person-protein', label: 'Someone gets a protein weekly' },
  { id: 'tag-count', label: 'At least / at most per week' },
  { id: 'no-consecutive', label: 'No repeat on consecutive days' },
];

const PROTEINS: ProteinClass[] = ['fish', 'shellfish', 'chicken', 'red-meat', 'pork', 'egg', 'legume'];
const TAGS: RecipeTag[] = ['traybake', 'salad', 'pasta', 'soup', 'curry', 'stir-fry', 'roast', 'grill', 'one-pot'];
const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Draft {
  kind: CustomRule['kind'];
  enforcement: Enforcement;
  proteins: ProteinClass[];
  tags: RecipeTag[];
  days: DayIndex[];
  slots: MealSlot[];
  personId: string;
  minPerWeek: number;
  tag: RecipeTag;
  bound: 'at-least' | 'at-most';
  count: number;
  by: 'cuisine' | 'tag';
}

function freshDraft(household: Household): Draft {
  return {
    kind: 'avoid',
    enforcement: 'hard',
    proteins: [],
    tags: [],
    days: [],
    slots: household.plannedSlots.includes('dinner') ? ['dinner'] : [household.plannedSlots[0]],
    personId: household.people[0]?.id ?? '',
    minPerWeek: 1,
    tag: 'traybake',
    bound: 'at-most',
    count: 2,
    by: 'cuisine',
  };
}

function newId(): string {
  return `rule-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Turn the form state into a rule, or null if it isn't complete yet. */
function buildRule(d: Draft): CustomRule | null {
  const id = 'draft';
  switch (d.kind) {
    case 'avoid':
      if (d.proteins.length === 0 && d.tags.length === 0) return null;
      return { id, kind: 'avoid', enforcement: d.enforcement, proteins: d.proteins, tags: d.tags, days: d.days, slots: d.slots };
    case 'person-protein':
      if (!d.personId || d.proteins.length === 0 || d.minPerWeek < 1) return null;
      return { id, kind: 'person-protein', enforcement: 'soft', personId: d.personId, proteins: d.proteins, minPerWeek: d.minPerWeek };
    case 'tag-count':
      if (d.count < 1) return null;
      return { id, kind: 'tag-count', enforcement: d.enforcement, tag: d.tag, bound: d.bound, count: d.count };
    case 'no-consecutive':
      return { id, kind: 'no-consecutive', enforcement: d.enforcement, by: d.by, tag: d.by === 'tag' ? d.tag : undefined, slot: 'dinner' };
  }
}

export function RulesEditor({ household, ctx, onChange }: Props) {
  const rules = household.customRules ?? [];
  const [draft, setDraft] = useState<Draft | null>(null);
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const rule = draft ? buildRule(draft) : null;
  // Clamp the enforcement to what this shape supports before previewing.
  const allowed = rule ? availableEnforcements(rule) : ['hard', 'soft'];
  const effective: Enforcement = rule && allowed.includes(rule.enforcement) ? rule.enforcement : 'soft';
  const previewRule = rule ? { ...rule, enforcement: effective, id: 'preview' } : null;

  const impact = useMemo(
    () => (previewRule ? previewImpact(previewRule, ctx) : null),
    [previewRule && JSON.stringify(previewRule), ctx],
  );

  function add() {
    if (!rule) return;
    const toSave: CustomRule = { ...rule, enforcement: effective, id: newId() } as CustomRule;
    onChange({ ...household, customRules: [...rules, toSave] });
    setDraft(null);
  }

  function remove(id: string) {
    onChange({ ...household, customRules: rules.filter((r) => r.id !== id) });
  }

  return (
    <section className="page rules" aria-label="House rules">
      <h2 className="panel-title">Your house rules</h2>
      <p className="rules__lead">
        Rules on top of the built-in ones. A <strong>hard</strong> rule is never broken; a{' '}
        <strong>soft</strong> rule is a weighted preference. You'll see what each one does before it's saved.
      </p>

      {rules.length > 0 ? (
        <ul className="rules__list">
          {rules.map((r) => (
            <li key={r.id} className="rules__item">
              <span>
                <span className={`rules__tag rules__tag--${effEnf(r)}`}>{effEnf(r)}</span>
                {describeRule(r, ctx)}
              </span>
              <button className="btn btn--ghost" onClick={() => remove(r.id)}>Remove</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rules__empty">No rules of your own yet.</p>
      )}

      {!draft ? (
        <button className="btn btn--primary" onClick={() => setDraft(freshDraft(household))}>
          Add a rule
        </button>
      ) : (
        <div className="rules__form">
          <label className="field">
            <span>Rule</span>
            <select value={draft.kind} onChange={(e) => set({ kind: e.target.value as Draft['kind'] })}>
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>{k.label}</option>
              ))}
            </select>
          </label>

          {draft.kind === 'avoid' && (
            <>
              <ChipRow label="Protein" options={PROTEINS} selected={draft.proteins} labelOf={proteinLabel} onToggle={(p) => set({ proteins: toggle(draft.proteins, p) })} />
              <ChipRow label="or tag" options={TAGS} selected={draft.tags} labelOf={tagLabel} onToggle={(t) => set({ tags: toggle(draft.tags, t) })} />
              <ChipRow label="On days (blank = every day)" options={[0, 1, 2, 3, 4, 5, 6] as DayIndex[]} selected={draft.days} labelOf={(d) => DAY_ABBR[d]} onToggle={(d) => set({ days: toggle(draft.days, d) })} />
              <ChipRow label="At" options={household.plannedSlots} selected={draft.slots} labelOf={(s) => s} onToggle={(s) => set({ slots: toggle(draft.slots, s) })} />
            </>
          )}

          {draft.kind === 'person-protein' && (
            <>
              <label className="field">
                <span>Who</span>
                <select value={draft.personId} onChange={(e) => set({ personId: e.target.value })}>
                  {household.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <ChipRow label="Gets" options={PROTEINS} selected={draft.proteins} labelOf={proteinLabel} onToggle={(p) => set({ proteins: toggle(draft.proteins, p) })} />
              <label className="field field--narrow">
                <span>At least ×/week</span>
                <input type="number" min={1} max={14} value={draft.minPerWeek} onChange={(e) => set({ minPerWeek: +e.target.value })} />
              </label>
            </>
          )}

          {draft.kind === 'tag-count' && (
            <div className="field-row">
              <label className="field field--narrow">
                <span>Bound</span>
                <select value={draft.bound} onChange={(e) => set({ bound: e.target.value as Draft['bound'] })}>
                  <option value="at-most">At most</option>
                  <option value="at-least">At least</option>
                </select>
              </label>
              <label className="field field--narrow">
                <span>Count</span>
                <input type="number" min={0} max={14} value={draft.count} onChange={(e) => set({ count: +e.target.value })} />
              </label>
              <label className="field">
                <span>Tag</span>
                <select value={draft.tag} onChange={(e) => set({ tag: e.target.value as RecipeTag })}>
                  {TAGS.map((t) => <option key={t} value={t}>{tagLabel(t)}</option>)}
                </select>
              </label>
            </div>
          )}

          {draft.kind === 'no-consecutive' && (
            <div className="field-row">
              <label className="field">
                <span>Don't repeat</span>
                <select value={draft.by} onChange={(e) => set({ by: e.target.value as Draft['by'] })}>
                  <option value="cuisine">the same cuisine</option>
                  <option value="tag">a tag</option>
                </select>
              </label>
              {draft.by === 'tag' && (
                <label className="field">
                  <span>Tag</span>
                  <select value={draft.tag} onChange={(e) => set({ tag: e.target.value as RecipeTag })}>
                    {TAGS.map((t) => <option key={t} value={t}>{tagLabel(t)}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}

          {/* Hard/soft, only where the shape allows a choice. */}
          <div className="rules__enf">
            <div className="chips">
              {(['hard', 'soft'] as Enforcement[]).map((e) => (
                <button
                  key={e}
                  className={`chip ${effective === e ? 'chip--on' : ''}`}
                  disabled={!allowed.includes(e)}
                  onClick={() => set({ enforcement: e })}
                >
                  {e}
                </button>
              ))}
            </div>
            <p className="rules__blurb">{enforcementBlurb(effective)}</p>
          </div>

          {/* The live effect — never save into an impossible week silently. */}
          {impact && (
            <div className={`rules__impact ${impact.ok ? '' : 'rules__impact--bad'}`}>
              <p className="rules__impact-head">{impact.ok ? 'Effect' : 'This would break your week'}</p>
              <p>{impact.headline}</p>
              {impact.details.length > 0 && (
                <ul>{impact.details.map((d, i) => <li key={i}>{d}</li>)}</ul>
              )}
            </div>
          )}
          {rule === null && <p className="rules__blurb">Fill in the rule to see its effect.</p>}

          <div className="actions">
            <button className="btn btn--primary" onClick={add} disabled={!rule}>Add rule</button>
            <button className="btn" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}

function ChipRow<T>({ label, options, selected, labelOf, onToggle }: {
  label: string;
  options: readonly T[];
  selected: T[];
  labelOf: (t: T) => string;
  onToggle: (t: T) => void;
}) {
  return (
    <div className="rules__chiprow">
      <span className="rules__chiprow-label">{label}</span>
      <div className="chips">
        {options.map((o) => (
          <button key={String(o)} className={`chip ${selected.includes(o) ? 'chip--on' : ''}`} onClick={() => onToggle(o)}>
            {labelOf(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/** Enforcement a stored rule actually runs as (unsupported hard shows as soft). */
function effEnf(r: CustomRule): Enforcement {
  const hardOK = availableEnforcements(r).includes('hard');
  return r.enforcement === 'hard' && hardOK ? 'hard' : 'soft';
}
