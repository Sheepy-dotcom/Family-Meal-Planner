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
  loadSessionId,
  clearAll,
  exportState,
  applyState,
  loadSyncCode,
  saveSyncCode,
  clearSyncCode,
  loadSyncVersion,
  saveSyncVersion,
} from '../store/persist.js';
import { generateCode, normaliseCode, pull, push } from '../store/sync.js';
import {
  proposeRules,
  applyProposal,
  favouritesFor,
  dishVerdicts,
  mealsMatchingProposal,
} from '../core/learning/feedback.js';
import type { RuleProposal } from '../core/learning/feedback.js';
import { analysePatterns } from '../core/learning/ai.js';
import { suggestPlannedOvers, applyPlannedOver } from '../core/planner/leftovers.js';
import { reconcilePlan, repairPlan } from '../core/planner/reconcile.js';
import { dropOrphanedMeals, mealsUsing } from '../core/planner/integrity.js';
import { weekPlanToText } from '../core/planner/share.js';
import type { ReconcileResult } from '../core/planner/reconcile.js';
import { SuggestionsPanel } from './components/SuggestionsPanel.js';
import { OnboardingFlow } from './components/OnboardingFlow.js';
import { UndoStack } from '../store/undo.js';
import { useBackButton, useStatusBar } from './useNative.js';
import { TabBar, type Tab } from './components/TabBar.js';
import { RecipeEditor } from './components/RecipeEditor.js';
import { RecipeLibrary } from './components/RecipeLibrary.js';
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
import { SyncPanel } from './components/SyncPanel.js';
import { checkFeasibility } from '../core/planner/feasibility.js';

export default function App() {
  const [household, setHousehold] = useState(loadHousehold);
  const [history, setHistory] = useState(loadHistory);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [swapping, setSwapping] = useState<{ day: DayIndex; slot: MealSlot } | null>(null);
  const [feedback, setFeedback] = useState(loadFeedback);
  const [dismissed, setDismissed] = useState(loadDismissed);
  // Patterns the model has surfaced this session. They merge into the same
  // suggestions list as the inferred ones and apply only when accepted.
  const [aiProposals, setAiProposals] = useState<RuleProposal[]>([]);
  const [analysing, setAnalysing] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const sessionId = useMemo(() => loadSessionId(), []);
  // Cross-device sync. The code is null until the household opts in.
  const [syncCode, setSyncCode] = useState<string | null>(loadSyncCode);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const syncVersion = useRef(loadSyncVersion());
  // The last blob we successfully pushed, so a no-op change doesn't re-push.
  const lastPushed = useRef<string>('');
  const [retailer, setRetailer] = useState(loadRetailer);
  const [onboarded, setOnboarded] = useState(hasHousehold);
  const [reviewing, setReviewing] = useState(false);
  const [pendingFix, setPendingFix] = useState<ReconcileResult | null>(null);
  // After accepting an avoid/block suggestion, the meals in this week it now
  // argues against — offered as a one-tap reshape.
  const [pendingReshape, setPendingReshape] = useState<{
    proposal: RuleProposal;
    affected: PlannedMeal[];
  } | null>(null);
  // A ref, not state: the stack mutates in place and shouldn't re-render on push.
  const undoStack = useRef(new UndoStack());
  const [undoLabel, setUndoLabel] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [reading, setReading] = useState<PlannedMeal | null>(null);
  const [tab, setTab] = useState<Tab>('meals');
  // Today and Week share the Meals tab. Opens on Today — most sessions are
  // "what's for tonight", not a replan — and the choice sticks for the session.
  const [mealsView, setMealsView] = useState<'today' | 'week'>('today');
  // The Recipes tab opens on the library — "what can it cook?" — with adding
  // your own a tap away.
  const [recipesView, setRecipesView] = useState<'browse' | 'add'>('browse');
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
            day,
            slot,
          },
        ]),
      );
    },
    [household],
  );

  /**
   * A per-person verdict, captured the moment it's easy — a meal that's just
   * been eaten, or a recipe just cooked. personId is set, which makes this the
   * strongest signal the learning engine has: a stated fact, not an inference.
   */
  const rateMeal = useCallback(
    (
      recipeId: string,
      personId: string,
      verdict: 'liked' | 'disliked' | 'missed',
      attendeeIds: string[],
      day?: DayIndex,
      slot?: MealSlot,
    ) => {
      setFeedback(
        recordFeedback([
          { type: verdict, recipeId, at: new Date().toISOString(), personId, attendeeIds, day, slot },
        ]),
      );
    },
    [],
  );

  // Current explicit verdicts, so a rating widget reads back its own state.
  const verdicts = useMemo(() => dishVerdicts(feedback, household), [feedback, household]);
  const verdictOf = useCallback(
    (recipeId: string, personId: string): 'liked' | 'disliked' | 'missed' | undefined => {
      const v = verdicts.find((x) => x.recipeId === recipeId);
      if (!v) return undefined;
      if (v.likedBy.includes(personId)) return 'liked';
      if (v.dislikedBy.includes(personId)) return 'disliked';
      if (v.missedBy.includes(personId)) return 'missed';
      return undefined;
    },
    [verdicts],
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

  /**
   * Share the week as plain text: the phone's native share sheet where it
   * exists (so it can go straight to a message), and a clipboard copy as the
   * fallback everywhere else.
   */
  const shareWeek = useCallback(async () => {
    if (!result) return;
    const text = weekPlanToText(result.plan, `Meals · week of ${formatWeek(weekStart)}`);
    const nav = navigator as Navigator & { share?: (data: { title?: string; text?: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: "This week's meals", text });
        return;
      } catch {
        // Share sheet dismissed — fall through to a copy.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1500);
    } catch {
      // Clipboard blocked; nothing more we can do here.
    }
  }, [result, weekStart]);

  const proposals = useMemo(() => {
    const inferred = proposeRules(feedback, household).filter((p) => !dismissed.includes(p.id));
    // AI-surfaced patterns lead — they were just asked for — and never double up
    // with an inferred proposal that reached the same conclusion.
    const ai = aiProposals.filter(
      (p) => !dismissed.includes(p.id) && !inferred.some((q) => q.id === p.id),
    );
    return [...ai, ...inferred];
  }, [feedback, household, dismissed, aiProposals]);

  /**
   * "What we've noticed" — ask the model to read the same anonymised history the
   * rule engine sees and describe patterns the fixed vocabulary can't. Whatever
   * comes back is vetted client-side and merged into the suggestions panel; it
   * changes nothing until someone accepts it.
   */
  const analyseNoticed = useCallback(async () => {
    setAnalysing(true);
    setAiStatus(null);
    const result = await analysePatterns(feedback, household, sessionId);
    setAnalysing(false);
    if (result.error) {
      setAiStatus(result.error);
      return;
    }
    const fresh = result.proposals.filter((p) => !dismissed.includes(p.id));
    setAiProposals(fresh);
    setAiStatus(
      fresh.length === 0
        ? 'Nothing new — the rules already capture what we can see.'
        : `${fresh.length} new suggestion${fresh.length === 1 ? '' : 's'} added to the panel on the Meals tab.`,
    );
  }, [feedback, household, sessionId, dismissed]);

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
      // The rule is in force from next week. If this week's plan already breaks
      // it, offer to bring the current week into line too.
      const affected = result ? mealsMatchingProposal(result.plan, proposal) : [];
      setPendingReshape(affected.length > 0 ? { proposal, affected } : null);
    },
    [household, result, checkpoint],
  );

  /**
   * Re-roll only the slots an accepted preference argues against. The engine
   * picks each replacement, so every new meal still passes the hard rules (and
   * now the new preference too) — the suggestion changed the rules, the solver
   * still chooses the dish.
   */
  const reshapeWeek = useCallback(() => {
    if (!result || !pendingReshape) return;
    checkpoint('updating this week to match');
    let plan = result.plan;
    for (const meal of pendingReshape.affected) {
      // Skip a slot already changed out from under us.
      if (
        !plan.meals.some(
          (m) => m.day === meal.day && m.slot === meal.slot && m.recipeId === meal.recipeId,
        )
      ) {
        continue;
      }
      plan = reroll(plan, { day: meal.day, slot: meal.slot }, ctx).plan;
    }
    setResult({
      plan,
      evaluation: evaluatePlan(plan.meals, ctx),
      unfilled: result.unfilled,
    });
    savePlan(plan);
    setPendingReshape(null);
  }, [result, pendingReshape, ctx, checkpoint]);

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
    // Innermost first: another tab returns to Meals, the Week view returns to
    // Today, and Today (the root) is the only place back finally exits.
    if (tab !== 'meals') return setTab('meals'), true;
    if (mealsView !== 'today') return setMealsView('today'), true;
    return false;
  }, [reading, swapping, reviewing, tab, mealsView]);

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

  /**
   * The nuclear option: wipe every stored key and reload. A reload (rather than
   * resetting state in place) is deliberate — it guarantees the app comes back
   * up exactly as it would on a first-ever launch, at the welcome screen, with
   * no stale in-memory state surviving the wipe.
   */
  const resetEverything = useCallback(() => {
    const ok = window.confirm(
      'Reset everything on this device and start over? Your household, plans, shopping list, recipes and history are erased. This cannot be undone.',
    );
    if (!ok) return;
    clearAll();
    window.location.reload();
  }, []);

  // --- cross-device sync -------------------------------------------------

  /**
   * After a synced-in blob overwrites storage, the in-memory React state is
   * stale. Rather than thread every setter through the sync code, re-read the
   * lot from storage in one place — the same shape the app boots with.
   */
  const reloadFromStorage = useCallback(() => {
    setHousehold(loadHousehold());
    setHistory(loadHistory());
    setFeedback(loadFeedback());
    setDismissed(loadDismissed());
    setRetailer(loadRetailer());
    setWeights(loadWeights() ?? DEFAULT_WEIGHTS);
    const recipes = loadUserRecipes();
    setUserRecipes(recipes);
    setUserRecipeState(recipes);
    setPantry(pantryForWeek(loadPantry(), weekStart));
    const saved = loadPlan();
    const nextCtx = { household: loadHousehold(), history: loadHistory() };
    if (saved && saved.weekStartISO === weekStart) {
      const safe = dropOrphanedMeals(saved);
      setResult({ plan: safe, evaluation: evaluatePlan(safe.meals, nextCtx), unfilled: [] });
    } else {
      setResult(null);
    }
    setPendingFix(null);
  }, [weekStart]);

  const adopt = useCallback(
    (remote: { version: number; blob: Record<string, string> }) => {
      applyState(remote.blob);
      syncVersion.current = remote.version;
      saveSyncVersion(remote.version);
      lastPushed.current = JSON.stringify(exportState());
      reloadFromStorage();
    },
    [reloadFromStorage],
  );

  /** Push local state up, adopting the server's if it has moved on since. */
  const pushNow = useCallback(async (code: string) => {
    const blob = exportState();
    const serialised = JSON.stringify(blob);
    if (serialised === lastPushed.current) return; // nothing changed
    const result = await push(code, blob, syncVersion.current);
    if ('conflict' in result) {
      adopt(result.current);
    } else {
      syncVersion.current = result.version;
      saveSyncVersion(result.version);
      lastPushed.current = serialised;
    }
  }, [adopt]);

  const syncNow = useCallback(async () => {
    if (!syncCode) return;
    setSyncBusy(true);
    setSyncStatus(null);
    try {
      const remote = await pull(syncCode);
      if (remote && remote.version !== syncVersion.current) adopt(remote);
      await pushNow(syncCode);
      setSyncStatus('Up to date on this device.');
    } catch {
      setSyncStatus("Couldn't reach sync. Your data is safe on this device — try again later.");
    } finally {
      setSyncBusy(false);
    }
  }, [syncCode, adopt, pushNow]);

  const createSync = useCallback(async () => {
    const code = generateCode();
    setSyncBusy(true);
    setSyncStatus(null);
    try {
      // A brand-new code has no server state, so this first push seeds it.
      syncVersion.current = 0;
      lastPushed.current = '';
      await pushNow(code);
      saveSyncCode(code);
      setSyncCode(code);
      setSyncStatus('Sync is on. Share the code with another phone to join.');
    } catch {
      setSyncStatus("Couldn't set up sync just now. Try again later.");
    } finally {
      setSyncBusy(false);
    }
  }, [pushNow]);

  const joinSync = useCallback(
    async (input: string) => {
      const code = normaliseCode(input);
      if (!code) {
        setSyncStatus('That code doesn’t look right — it’s like MEAL-7QK2Z.');
        return;
      }
      if (
        !window.confirm(
          'Joining replaces this device’s plan and settings with the shared household’s. Continue?',
        )
      )
        return;
      setSyncBusy(true);
      setSyncStatus(null);
      try {
        const remote = await pull(code);
        if (!remote) {
          setSyncStatus('No household found for that code. Check it and try again.');
          return;
        }
        adopt(remote);
        saveSyncCode(code);
        setSyncCode(code);
        setSyncStatus('Joined. This device now shares that household’s plan.');
      } catch {
        setSyncStatus("Couldn't reach sync. Try again later.");
      } finally {
        setSyncBusy(false);
      }
    },
    [adopt],
  );

  const stopSync = useCallback(() => {
    clearSyncCode();
    setSyncCode(null);
    syncVersion.current = 0;
    lastPushed.current = '';
    setSyncStatus('Sync is off. This device keeps its own copy from here.');
  }, []);

  // Pull once on boot if this device is part of a household.
  useEffect(() => {
    if (!syncCode) return;
    let cancelled = false;
    (async () => {
      try {
        const remote = await pull(syncCode);
        if (!cancelled && remote && remote.version !== syncVersion.current) adopt(remote);
      } catch {
        // Offline or the endpoint is down — the local copy stands in.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Boot-time pull only; later syncs are driven by the change effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced push whenever the shared state changes, if syncing is on.
  useEffect(() => {
    if (!syncCode) return;
    const id = setTimeout(() => {
      void pushNow(syncCode).catch(() => {});
    }, 1500);
    return () => clearTimeout(id);
  }, [syncCode, pushNow, household, history, feedback, dismissed, retailer, weights, userRecipes, pantry, result]);

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
          <h1>
            {tab === 'meals'
              ? mealsView === 'today'
                ? 'Today'
                : `Week of ${formatWeek(weekStart)}`
              : SECTION_TITLES[tab]}
          </h1>
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
          {tab === 'meals' && mealsView === 'week' && (
            <button className="btn btn--primary" onClick={() => plan(Date.now() % 100000)}>
              {result ? 'Plan again' : 'Plan the week'}
            </button>
          )}
          {tab === 'meals' && mealsView === 'week' && result && (
            <button className="btn" onClick={() => setReviewing(true)}>
              Mark as cooked
            </button>
          )}
          {tab === 'meals' && mealsView === 'week' && result && (
            <button className="btn" onClick={shareWeek}>
              {shareCopied ? 'Copied' : 'Share week'}
            </button>
          )}
        </div>
      </header>

      {tab === 'meals' && (
        <>
          <div className="seg" role="tablist" aria-label="Meals view">
            <button
              role="tab"
              aria-selected={mealsView === 'today'}
              className={`seg__btn ${mealsView === 'today' ? 'seg__btn--on' : ''}`}
              onClick={() => setMealsView('today')}
            >
              Today
            </button>
            <button
              role="tab"
              aria-selected={mealsView === 'week'}
              className={`seg__btn ${mealsView === 'week' ? 'seg__btn--on' : ''}`}
              onClick={() => setMealsView('week')}
            >
              Week
            </button>
          </div>

          {mealsView === 'today' && (
            <Today
              plan={result?.plan ?? null}
              household={household}
              onCook={setReading}
              onGoToWeek={() => setMealsView('week')}
              verdictOf={verdictOf}
              onRate={rateMeal}
            />
          )}

          {mealsView === 'week' && (
            <>
              {pendingReshape && (
                <div className="status" style={{ marginTop: 24 }}>
                  <h3>Bring this week in line?</h3>
                  <p>
                    Accepting that affects {pendingReshape.affected.length} meal
                    {pendingReshape.affected.length === 1 ? '' : 's'} already planned this
                    week. Update {pendingReshape.affected.length === 1 ? 'it' : 'them'} to
                    match, or leave the week as it is.
                  </p>
                  <div className="actions" style={{ marginTop: 12 }}>
                    <button className="btn btn--primary" onClick={reshapeWeek}>
                      Update this week
                    </button>
                    <button className="btn btn--ghost" onClick={() => setPendingReshape(null)}>
                      Leave it
                    </button>
                  </div>
                </div>
              )}

              {pendingFix && (
                <div className="warn" style={{ marginTop: 24 }}>
                  <h3>That changed a few things</h3>
                  <ul>
                    {pendingFix.broken.map((v, i) => (
                      <li key={i}>{v.message}</li>
                    ))}
                    {pendingFix.emptied.map((e) => (
                      <li key={`${e.day}-${e.slot}`}>
                        Nobody's eating {DAY_NAMES[e.day]} {e.slot} any more, so it's
                        been dropped.
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

              {!feasibility.ok && (
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

              {!result ? (
                <div className="empty">
                  <h2 className="empty__title">Ready when you are</h2>
                  <p>
                    Press <strong>Plan the week</strong> and you'll get seven days of
                    meals that respect everything you've told me — who's eating, what
                    they avoid, and how long you've actually got on a weeknight.
                  </p>
                  <p className="empty__aside">
                    You can change any meal afterwards, and the shopping list updates
                    with it.
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
              )}
            </>
          )}
        </>
      )}

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
          weeksOfHistory={history.length}
          onAnalyse={analyseNoticed}
          analysing={analysing}
          analysisStatus={aiStatus}
          onClose={() => setTab('meals')}
        />
      )}

      {tab === 'recipes' && (
        <>
          <div className="seg" role="tablist" aria-label="Recipes view">
            <button
              role="tab"
              aria-selected={recipesView === 'browse'}
              className={`seg__btn ${recipesView === 'browse' ? 'seg__btn--on' : ''}`}
              onClick={() => setRecipesView('browse')}
            >
              Browse
            </button>
            <button
              role="tab"
              aria-selected={recipesView === 'add'}
              className={`seg__btn ${recipesView === 'add' ? 'seg__btn--on' : ''}`}
              onClick={() => setRecipesView('add')}
            >
              Add your own
            </button>
          </div>

          {recipesView === 'browse' ? (
            <RecipeLibrary />
          ) : (
            <RecipeEditor
              variant="page"
              onSave={saveRecipe}
              onDelete={deleteRecipe}
              onClose={() => setTab('meals')}
              usageOf={(id) => (result ? mealsUsing(result.plan, id).length : 0)}
            />
          )}
        </>
      )}

      {tab === 'settings' && (
        <>
          <RulesEditor household={household} ctx={ctx} onChange={changeHousehold} />
          <SyncPanel
            code={syncCode}
            busy={syncBusy}
            status={syncStatus}
            onCreate={createSync}
            onJoin={joinSync}
            onSyncNow={syncNow}
            onStop={stopSync}
          />
          <HouseholdEditor
            variant="page"
            household={household}
            ctx={ctx}
            onChange={changeHousehold}
            onReset={resetEverything}
            onClose={() => setTab('meals')}
          />
        </>
      )}


      {reading && result && (
        <RecipeView
          meal={reading}
          plan={result.plan}
          ctx={ctx}
          verdictOf={verdictOf}
          onRate={rateMeal}
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
          feedback={feedback}
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

// The Meals tab titles itself from its sub-view (Today / Week of …); the rest
// are fixed section headings.
const SECTION_TITLES: Record<Exclude<Tab, 'meals'>, string> = {
  shop: 'Shopping list',
  people: 'Who eats what',
  recipes: 'Recipes',
  settings: 'Household',
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
