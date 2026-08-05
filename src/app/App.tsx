import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generatePlan, reroll } from '../core/planner/solver.js';
import { evaluatePlan, type RuleContext } from '../core/rules/index.js';
import { buildShoppingList, allLines } from '../core/shopping/list.js';
import { flagShoppingList } from '../core/diet/screen.js';
import { attendeesFor, portionsFor, DAY_NAMES } from '../core/rules/context.js';
import type { DayIndex, MealPlan, MealSlot, PlannedMeal } from '../core/types.js';
import type { SolveResult } from '../core/planner/solver.js';
import {
  archiveWeek,
  loadHistory,
  loadHousehold,
  loadPlan,
  savePlan,
  saveHousehold,
  loadFeedback,
  recordFeedback,
  loadDismissed,
  dismissProposal,
  loadRetailer,
  saveRetailer,
  hasHousehold,
  loadWeights,
  saveWeights,
  loadUserRecipes,
  saveUserRecipes,
  loadPantry,
  savePantry,
} from '../store/persist.js';
import { proposeRules, applyProposal, favouritesFor } from '../core/learning/feedback.js';
import { suggestPlannedOvers, applyPlannedOver } from '../core/planner/leftovers.js';
import { reconcilePlan, repairPlan } from '../core/planner/reconcile.js';
import { dropOrphanedMeals, mealsUsing } from '../core/planner/integrity.js';
import type { ReconcileResult } from '../core/planner/reconcile.js';
import { SuggestionsPanel } from './components/SuggestionsPanel.js';
import { OnboardingFlow } from './components/OnboardingFlow.js';
import { UndoStack } from '../store/undo.js';
import { useBackButton, useStatusBar } from './useNative.js';
import { TabBar, type Tab } from './components/TabBar.js';
import { RecipeEditor } from './components/RecipeEditor.js';
import { setUserRecipes } from '../core/data/registry.js';
import {
  pantryForWeek,
  toggleHave,
  toggleAlwaysStocked,
} from '../core/pantry/pantry.js';
import { CookedReview } from './components/CookedReview.js';
import { RecipeView } from './components/RecipeView.js';
import { PersonView } from './components/PersonView.js';
import { weightsForLean } from '../core/onboarding/questions.js';
import { DEFAULT_WEIGHTS } from '../core/rules/config.js';
import { SEED_HOUSEHOLD } from '../core/data/household.js';
import { WeekBoard } from './components/WeekBoard.js';
import { Today } from './components/Today.js';
import { RuleRail } from './components/RuleRail.js';
import { ShoppingPanel } from './components/ShoppingPanel.js';
import { SwapSheet } from './components/SwapSheet.js';
import { HouseholdEditor } from './components/HouseholdEditor.js';
import { RulesEditor } from './components/RulesEditor.js';
import { checkFeasibility } from '../core/planner/feasibility.js';

export default function App() {
  const [household, setHousehold] = useState(loadHousehold);
  const [history, setHistory] = useState(loadHistory);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [swapping, setSwapping] = useState<{ day: DayIndex; slot: MealSlot } | null>(null);
  const [feedback, setFeedback] = useState(loadFeedback);
  const [dismissed, setDismissed] = useState(loadDismissed);
  const [retailer, setRetailer] = useState(loadRetailer);
  const [onboarded, setOnboarded] = useState(hasHousehold);
  const [reviewing, setReviewing] = useState(false);
  const [pendingFix, setPendingFix] = useState<ReconcileResult | null>(null);
  // A ref, not state: the stack mutates in place and shouldn't re-render on push.
  const undoStack = useRef(new UndoStack());
  const [undoLabel, setUndoLabel] = useState<string | null>(null);
  const [reading, setReading] = useState<PlannedMeal | null>(null);
  // Opens on Today: most sessions are "what's for tonight", not a replan.
  const [tab, setTab] = useState<Tab>('today');
  // Rolled to the current week on load, which wipes last week's ticks. Carrying
  // them forward is what makes inventory tracking go stale.
  const [pantry, setPantry] = useState(() => loadPantry());
  // Load the household's own dishes into the registry before anything plans
  // with them, so the solver and the shopping list see the same book.
  const [userRecipes, setUserRecipeState] = useState(() => {
    const stored = loadUserRecipes();
    setUserRecipes(stored);
    return stored;
  });

  /** Snapshot the current state before anything that changes it. */
  const checkpoint = useCallback(
    (label: string) => {
      undoStack.current.push(label, household, result?.plan ?? null);
      setUndoLabel(undoStack.current.peek());
    },
    [household, result],
  );

  const undo = useCallback(() => {
    const snapshot = undoStack.current.undo(household, result?.plan ?? null);
    if (!snapshot) return;
    setHousehold(snapshot.household);
    saveHousehold(snapshot.household);
    const nextCtx = { household: snapshot.household, history };
    if (snapshot.plan) {
      setResult({
        plan: snapshot.plan,
        evaluation: evaluatePlan(snapshot.plan.meals, nextCtx),
        unfilled: [],
      });
      savePlan(snapshot.plan);
    }
    setPendingFix(null);
    setUndoLabel(undoStack.current.peek());
  }, [household, result, history]);
  const [weights, setWeights] = useState(() => loadWeights() ?? DEFAULT_WEIGHTS);

  /**
   * Stated favourites are folded into the household the rules see, so the
   * engine stays a pure function of its context rather than reaching into
   * feedback storage itself.
   */
  const ctx: RuleContext = useMemo(() => {
    const favouritesByPerson: Record<string, string[]> = {};
    for (const person of household.people) {
      const favourites = favouritesFor(feedback, person.id);
      if (favourites.length > 0) favouritesByPerson[person.id] = favourites;
    }
    return { household: { ...household, favouritesByPerson }, history };
  }, [household, history, feedback]);
  const weekStart = useMemo(() => mondayOf(new Date()), []);

  // Restore last week's plan rather than regenerating on load — a plan people
  // have already shopped for must not silently change under them.
  useEffect(() => {
    const rolled = pantryForWeek(loadPantry(), weekStart);
    setPantry(rolled);
    savePantry(rolled);

    const saved = loadPlan();
    if (saved && saved.weekStartISO === weekStart) {
      // A stored plan can reference a recipe that has since been deleted.
      // Dropping those meals leaves an empty slot the user can fill, which is
      // far better than the blank screen this used to cause.
      const safe = dropOrphanedMeals(saved);
      setResult({
        plan: safe,
        evaluation: evaluatePlan(safe.meals, ctx),
        unfilled: [],
      });
      if (safe.meals.length !== saved.meals.length) savePlan(safe);
    }
    // Deliberately runs once: this is restore-on-boot, not a sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plan = useCallback(
    (seed: number) => {
      if (result) checkpoint('replanning the week');
      const next = generatePlan(ctx, weekStart, { seed, weights });
      setResult(next);
      savePlan(next.plan);
    },
    [ctx, weekStart, weights, result, checkpoint],
  );

  /**
   * A swap is the household telling us something. Capture it — with who was at
   * the table, which is the only thing that later makes it possible to say
   * whose preference it was rather than banning a dish for everyone.
   */
  const noteRejection = useCallback(
    (recipeId: string, day: DayIndex, slot: MealSlot) => {
      setFeedback(
        recordFeedback([
          {
            type: 'rejected',
            recipeId,
            at: new Date().toISOString(),
            attendeeIds: attendeesFor(household, day, slot).map((p) => p.id),
          },
        ]),
      );
    },
    [household],
  );

  const swapMeal = useCallback(
    (recipeId: string) => {
      if (!result || !swapping) return;
      const replaced = result.plan.meals.find(
        (m) => m.day === swapping.day && m.slot === swapping.slot,
      );
      checkpoint('that swap');
      if (replaced) noteRejection(replaced.recipeId, swapping.day, swapping.slot);
      const attendees = attendeesFor(household, swapping.day, swapping.slot);
      const meals = [
        ...result.plan.meals.filter(
          (m) => !(m.day === swapping.day && m.slot === swapping.slot),
        ),
        {
          day: swapping.day,
          slot: swapping.slot,
          recipeId,
          portions: portionsFor(attendees),
          attendeeIds: attendees.map((p) => p.id),
        },
      ].sort((a, b) => a.day - b.day);

      const nextPlan: MealPlan = { ...result.plan, meals };
      setResult({
        plan: nextPlan,
        evaluation: evaluatePlan(meals, ctx),
        unfilled: result.unfilled.filter(
          (u) => !(u.day === swapping.day && u.slot === swapping.slot),
        ),
      });
      savePlan(nextPlan);
      setSwapping(null);
    },
    [result, swapping, household, ctx, noteRejection, checkpoint],
  );

  const rerollMeal = useCallback(() => {
    if (!result || !swapping) return;
    const replaced = result.plan.meals.find(
      (m) => m.day === swapping.day && m.slot === swapping.slot,
    );
    if (replaced) noteRejection(replaced.recipeId, swapping.day, swapping.slot);
    const next = reroll(result.plan, swapping, ctx);
    setResult({ ...next, unfilled: result.unfilled });
    savePlan(next.plan);
    setSwapping(null);
  }, [result, swapping, ctx, noteRejection]);

  const finishWeek = useCallback(
    (events: Parameters<typeof recordFeedback>[0]) => {
      if (!result) return;
      setHistory(archiveWeek(result.plan));
      setFeedback(recordFeedback(events));
      setReviewing(false);
    },
    [result],
  );

  const proposals = useMemo(
    () =>
      proposeRules(feedback, household).filter((p) => !dismissed.includes(p.id)),
    [feedback, household, dismissed],
  );

  const plannedOvers = useMemo(
    () => (result ? suggestPlannedOvers(result.plan, ctx) : []),
    [result, ctx],
  );

  const acceptProposal = useCallback(
    (proposal: (typeof proposals)[number]) => {
      checkpoint(`accepting "${proposal.suggestion.replace(/\?$/, '')}"`);
      const next = applyProposal(household, proposal);
      setHousehold(next);
      saveHousehold(next);
      setDismissed(dismissProposal(proposal.id));
    },
    [household, checkpoint],
  );

  const applyCarry = useCallback(
    (suggestion: (typeof plannedOvers)[number]) => {
      if (!result) return;
      checkpoint('the planned-over');
      const nextPlan = applyPlannedOver(result.plan, suggestion);
      setResult({
        ...result,
        plan: nextPlan,
        evaluation: evaluatePlan(nextPlan.meals, ctx),
      });
      savePlan(nextPlan);
    },
    [result, ctx],
  );

  /**
   * Any settings change — a person, a time budget, an added rule — is
   * reconciled against the current plan the same way a swap or an attendance
   * toggle is. Portions and attendance are corrected, a meal a new rule has
   * broken is surfaced rather than left silently illegal, and the evaluation is
   * always recomputed so the rule rail reflects the change instead of lagging a
   * plan behind. The plan is only re-saved when it actually moved.
   */
  const changeHousehold = useCallback(
    (next: typeof household) => {
      setHousehold(next);
      saveHousehold(next);
      if (!result) return;

      const nextCtx = { household: next, history };
      const reconciled = reconcilePlan(result.plan, nextCtx);
      const planChanged =
        reconciled.plan.meals.length !== result.plan.meals.length ||
        reconciled.plan.meals.some((m, i) => m !== result.plan.meals[i]);
      const plan = planChanged ? reconciled.plan : result.plan;

      setResult({
        plan,
        evaluation: evaluatePlan(plan.meals, nextCtx),
        unfilled: result.unfilled,
      });
      if (planChanged) savePlan(plan);
      setPendingFix(
        reconciled.broken.length > 0 || reconciled.emptied.length > 0 ? reconciled : null,
      );
    },
    [result, history],
  );

  /**
   * Toggling someone in or out of a meal.
   *
   * Portions are corrected immediately because that's arithmetic. Meals the
   * change has made illegal are surfaced rather than swapped, because the
   * household chose those dishes and may have already shopped for them.
   */
  const toggleAttendance = useCallback(
    (personId: string, day: DayIndex, slot: MealSlot) => {
      const away = household.absences.some(
        (a) => a.personId === personId && a.day === day && a.slot === slot,
      );
      checkpoint(away ? 'marking them back in' : 'marking them away');
      const nextHousehold = {
        ...household,
        absences: away
          ? household.absences.filter(
              (a) => !(a.personId === personId && a.day === day && a.slot === slot),
            )
          : [...household.absences, { personId, day, slot }],
      };

      setHousehold(nextHousehold);
      saveHousehold(nextHousehold);

      if (!result) return;
      const nextCtx = { household: nextHousehold, history };
      const reconciled = reconcilePlan(result.plan, nextCtx);
      setResult({
        plan: reconciled.plan,
        evaluation: evaluatePlan(reconciled.plan.meals, nextCtx),
        unfilled: result.unfilled,
      });
      savePlan(reconciled.plan);
      setPendingFix(
        reconciled.broken.length > 0 || reconciled.emptied.length > 0
          ? reconciled
          : null,
      );
    },
    [household, result, history, checkpoint],
  );

  const applyRepair = useCallback(() => {
    if (!result || !pendingFix) return;
    checkpoint('fixing those meals');
    const repaired = repairPlan(result.plan, ctx, pendingFix.broken);
    setResult({
      plan: repaired.plan,
      evaluation: evaluatePlan(repaired.plan.meals, ctx),
      unfilled: result.unfilled,
    });
    savePlan(repaired.plan);
    setPendingFix(null);
  }, [result, pendingFix, ctx, checkpoint]);

  // Checked before planning, so an impossible setting is caught at the source
  // rather than showing up as a hole in a generated week.
  const feasibility = useMemo(() => checkFeasibility(ctx), [ctx]);

  const saveRecipe = useCallback(
    (recipe: Parameters<typeof setUserRecipes>[0][number]) => {
      const next = [...userRecipes.filter((r) => r.id !== recipe.id), recipe];
      setUserRecipeState(next);
      setUserRecipes(next);
      saveUserRecipes(next);
    },
    [userRecipes],
  );

  const deleteRecipe = useCallback(
    (recipeId: string) => {
      const next = userRecipes.filter((r) => r.id !== recipeId);
      setUserRecipeState(next);
      setUserRecipes(next);
      saveUserRecipes(next);

      // If the deleted dish was on this week's plan, remove those meals too.
      // Leaving them behind means every later read of the plan throws.
      if (result && mealsUsing(result.plan, recipeId).length > 0) {
        const pruned = dropOrphanedMeals(result.plan);
        setResult({
          plan: pruned,
          evaluation: evaluatePlan(pruned.meals, ctx),
          unfilled: result.unfilled,
        });
        savePlan(pruned);
      }
    },
    [userRecipes, result, ctx],
  );

  const updatePantry = useCallback(
    (next: typeof pantry) => {
      setPantry(next);
      savePantry(next);
    },
    [],
  );

  const shopping = useMemo(
    () => (result ? buildShoppingList(result.plan) : null),
    [result],
  );
  const flagged = useMemo(
    () => (shopping ? flagShoppingList(shopping, household) : []),
    [shopping, household],
  );

  useStatusBar();

  /**
   * Android back closes whatever is open, innermost first, and only exits when
   * nothing is left. Order matters: the topmost sheet must go first, or back
   * appears to skip a layer.
   */
  const handleBack = useCallback(() => {
    if (reading) return setReading(null), true;
    if (swapping) return setSwapping(null), true;
    if (reviewing) return setReviewing(false), true;
    // From any other tab, back returns to Today rather than leaving — the same
    // behaviour as a native app's root tab.
    if (tab !== 'today') return setTab('today'), true;
    return false;
  }, [reading, swapping, reviewing, tab]);

  useBackButton(handleBack);

  const finishOnboarding = useCallback(
    (next: typeof household, lean: Parameters<typeof weightsForLean>[0]) => {
      const tuned = weightsForLean(lean, DEFAULT_WEIGHTS);
      setHousehold(next);
      saveHousehold(next);
      setWeights(tuned);
      saveWeights(tuned);
      setOnboarded(true);
      const first = generatePlan({ household: next, history: [] }, weekStart, {
        seed: Date.now() % 100000,
        weights: tuned,
      });
      setResult(first);
      savePlan(first.plan);
    },
    [weekStart],
  );

  const useSampleData = useCallback(() => {
    setHousehold(SEED_HOUSEHOLD);
    saveHousehold(SEED_HOUSEHOLD);
    setOnboarded(true);
  }, []);

  if (!onboarded) {
    return (
      <div className="shell">
        <OnboardingFlow onFinish={finishOnboarding} onUseSample={useSampleData} />
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="masthead">
        <div>
          <h1>{TAB_TITLES[tab](formatWeek(weekStart))}</h1>
          <p className="dateline">
            {household.name} · {household.people.length} people ·{' '}
            {history.length} week{history.length === 1 ? '' : 's'} of history
          </p>
        </div>
        <div className="actions">
          {undoLabel && (
            <button className="btn" onClick={undo}>
              Undo {undoLabel}
            </button>
          )}
          {tab === 'week' && (
            <button className="btn btn--primary" onClick={() => plan(Date.now() % 100000)}>
              {result ? 'Plan again' : 'Plan the week'}
            </button>
          )}
          {tab === 'week' && result && (
            <button className="btn" onClick={() => setReviewing(true)}>
              Mark as cooked
            </button>
          )}
        </div>
      </header>

      {!feasibility.ok && (
        <div className="warn" style={{ marginTop: 24 }}>
          <h3>Some slots can't be filled</h3>
          <ul>
            {feasibility.impossible.slice(0, 4).map((s) => (
              <li key={`${s.day}-${s.slot}`}>{s.message}</li>
            ))}
          </ul>
          <p>Open Household to relax a rule, or add recipes that fit.</p>
        </div>
      )}

      {pendingFix && tab === 'week' && (
        <div className="warn" style={{ marginTop: 24 }}>
          <h3>That changed a few things</h3>
          <ul>
            {pendingFix.broken.map((v, i) => (
              <li key={i}>{v.message}</li>
            ))}
            {pendingFix.emptied.map((e) => (
              <li key={`${e.day}-${e.slot}`}>
                Nobody's eating {DAY_NAMES[e.day]} {e.slot} any more, so it's been
                dropped.
              </li>
            ))}
          </ul>
          <div className="actions" style={{ marginTop: 12 }}>
            {pendingFix.broken.length > 0 && (
              <button className="btn" onClick={applyRepair}>
                Fix just those meals
              </button>
            )}
            <button className="btn btn--ghost" onClick={() => setPendingFix(null)}>
              Leave it
            </button>
          </div>
        </div>
      )}

      {!feasibility.ok && tab === 'week' && (
        <div className="warn" style={{ marginTop: 24 }}>
          <h3>Some slots can't be filled</h3>
          <ul>
            {feasibility.impossible.slice(0, 4).map((s) => (
              <li key={`${s.day}-${s.slot}`}>{s.message}</li>
            ))}
          </ul>
          <p>Open Settings to relax a rule, or add recipes that fit.</p>
        </div>
      )}

      {tab === 'today' && (
        <Today
          plan={result?.plan ?? null}
          household={household}
          onCook={setReading}
          onGoToWeek={() => setTab('week')}
        />
      )}

      {tab === 'week' &&
        (!result ? (
          <div className="empty">
            <h2 className="empty__title">Ready when you are</h2>
            <p>
              Press <strong>Plan the week</strong> and you'll get seven days of meals
              that respect everything you've told me — who's eating, what they avoid,
              and how long you've actually got on a weeknight.
            </p>
            <p className="empty__aside">
              You can change any meal afterwards, and the shopping list updates with it.
            </p>
          </div>
        ) : (
          <>
            <div className="layout">
              <WeekBoard
                plan={result.plan}
                household={household}
                ctx={ctx}
                unfilled={result.unfilled}
                onSwap={(day, slot) => setSwapping({ day, slot })}
                onToggleAttendance={toggleAttendance}
                onRead={setReading}
              />
              <RuleRail evaluation={result.evaluation} />
            </div>

            <SuggestionsPanel
              proposals={proposals}
              plannedOvers={plannedOvers}
              onAccept={acceptProposal}
              onDismiss={(p) => setDismissed(dismissProposal(p.id))}
              onApplyPlannedOver={applyCarry}
            />
          </>
        ))}

      {tab === 'shop' &&
        (shopping ? (
          <ShoppingPanel
            list={shopping}
            flagged={flagged}
            retailer={retailer}
            pantry={pantry}
            onRetailerChange={(id) => {
              setRetailer(id);
              saveRetailer(id);
            }}
            onToggleHave={(id) => updatePantry(toggleHave(pantry, id))}
            onToggleAlwaysStocked={(id) =>
              updatePantry(toggleAlwaysStocked(pantry, id))
            }
          />
        ) : (
          <div className="empty">
            <h2 className="empty__title">No list yet</h2>
            <p>Plan a week first and the shopping list builds itself from it.</p>
          </div>
        ))}

      {tab === 'people' && result && (
        <PersonView
          variant="page"
          plan={result.plan}
          ctx={ctx}
          feedback={feedback}
          onClose={() => setTab('week')}
        />
      )}

      {tab === 'recipes' && (
        <RecipeEditor
          variant="page"
          onSave={saveRecipe}
          onDelete={deleteRecipe}
          onClose={() => setTab('week')}
          usageOf={(id) => (result ? mealsUsing(result.plan, id).length : 0)}
        />
      )}

      {tab === 'settings' && (
        <>
          <RulesEditor household={household} ctx={ctx} onChange={changeHousehold} />
          <HouseholdEditor
            variant="page"
            household={household}
            ctx={ctx}
            onChange={changeHousehold}
            onClose={() => setTab('week')}
          />
        </>
      )}


      {reading && result && (
        <RecipeView
          meal={reading}
          plan={result.plan}
          ctx={ctx}
          onClose={() => setReading(null)}
          onSwap={() => {
            setSwapping({ day: reading.day, slot: reading.slot });
            setReading(null);
          }}
        />
      )}

      {swapping && result && (
        <SwapSheet
          target={swapping}
          plan={result.plan}
          ctx={ctx}
          onChoose={swapMeal}
          onReroll={rerollMeal}
          onClose={() => setSwapping(null)}
        />
      )}

      {reviewing && result && (
        <CookedReview
          plan={result.plan}
          household={household}
          onFinish={finishWeek}
          onSkip={() => setReviewing(false)}
        />
      )}



      <TabBar
        active={tab}
        hasPlan={!!result}
        shopCount={shopping ? allLines(shopping).length : 0}
        noticeCount={proposals.length + plannedOvers.length}
        onSelect={setTab}
      />

      <p className="footnote">
        Dietary flags are advisory. They're generated from this app's own ingredient
        data and can't account for reformulated products, "may contain" warnings,
        shared production lines, or substitutions made when an order is picked.
        Always read the label.
      </p>
    </div>
  );
}

const TAB_TITLES: Record<Tab, (week: string) => string> = {
  today: () => 'Today',
  week: (week) => `Week of ${week}`,
  shop: () => 'Shopping list',
  people: () => 'Who eats what',
  recipes: () => 'Recipes',
  settings: () => 'Household',
};

function mondayOf(date: Date): string {
  const d = new Date(date);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
}

function formatWeek(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}
