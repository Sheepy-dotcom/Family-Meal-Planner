import { getIngredient } from '../data/ingredients.js';
import { getRecipe } from '../data/registry.js';
import type {
  Cuisine,
  DayIndex,
  Household,
  MealPlan,
  MealSlot,
  PlannedMeal,
  ProteinClass,
  Recipe,
  RecipeTag,
} from '../types.js';

/**
 * Learning household rules from behaviour instead of a settings form.
 *
 * Nobody types fifteen idiosyncratic rules into an onboarding wizard. But
 * people will swap a meal they don't fancy, and that swap is the same
 * information. This module turns a stream of small actions into *proposed*
 * rules the household can accept or dismiss.
 *
 * Two design commitments:
 *
 *  - **Nothing is applied automatically.** A planner that silently rewrites its
 *    own rules based on inference is one people stop being able to predict, and
 *    predictability is most of the value here. Proposals surface; humans decide.
 *  - **Every proposal shows its evidence.** "You've swapped away three fish
 *    dinners this month" is checkable. "We think you dislike fish" is not.
 */

export type FeedbackType =
  | 'rejected' // swapped this dish out of a slot
  | 'cooked' // week was marked as cooked with this dish in it
  | 'liked'
  | 'disliked'
  | 'missed'; // planned, but not eaten — by one person or the whole table

export interface FeedbackEvent {
  type: FeedbackType;
  recipeId: string;
  /** ISO date, used to weight recent behaviour and to age evidence out. */
  at: string;
  /**
   * Who was at the table. Without this a rejection can only ever be attributed
   * to the whole household, which is how a planner ends up refusing to serve
   * anyone mushrooms because one person doesn't like them.
   */
  attendeeIds?: string[];
  /**
   * Whose verdict this is, when someone said so explicitly.
   *
   * Much stronger than the attendance-based inference below: "Katie loved it"
   * is a fact, whereas "Katie was at the table when it got swapped" is a guess
   * that needs contrast to mean anything. Explicit beats inferred everywhere
   * the two disagree.
   */
  personId?: string;
  /**
   * Where in the week this happened. The inference engine here doesn't use it —
   * a household rule can't be conditioned on a weekday — but it's the context a
   * pattern-reader needs to tell "curries get swapped on weeknights" from "we've
   * gone off curry". Optional: events captured before this was recorded lack it.
   */
  day?: DayIndex;
  slot?: MealSlot;
}

export type ProposalKind =
  | 'block-recipe'
  | 'avoid-tag'
  | 'avoid-cuisine'
  | 'avoid-ingredient'
  | 'favour-recipe';

export interface RuleProposal {
  id: string;
  kind: ProposalKind;
  /**
   * Whose preference this is, when the evidence can tell.
   *
   * Undefined means genuinely unknown, not "everyone". If the household always
   * eats together there is no way to distinguish one person's dislike from
   * another's, and claiming otherwise would be inventing a fact.
   */
  personId?: string;
  personName?: string;
  /** The thing the rule is about: a recipe id, tag, cuisine or ingredient id. */
  subject: string;
  /** Sentence shown to the user, phrased as a suggestion they can decline. */
  suggestion: string;
  /** Why we think so, in checkable terms. */
  evidence: string;
  /** How many events back this up. Below MIN_EVIDENCE we don't propose at all. */
  strength: number;
}

/**
 * Three strikes. Two is a coincidence — a busy Tuesday, a dish that clashed
 * with something else that week. Proposing a permanent rule off two data points
 * produces suggestions people dismiss, and a suggestion stream people dismiss
 * is one they stop reading.
 */
const MIN_EVIDENCE = 3;

/**
 * Work out whose preference a pattern belongs to.
 *
 * A person is a candidate if they were at the table for *every* negative event
 * about this subject. That alone isn't enough: if everyone eats together, every
 * person qualifies and the test has told us nothing. So attribution also
 * requires **contrast** — at least one household member who missed at least one
 * of those meals. Without contrast the honest answer is "we can't tell", and
 * the proposal goes to the household as a whole.
 *
 * Anyone with a recorded 'liked' for the same subject is ruled out, since
 * enjoying something is stronger evidence than being present when it was
 * swapped for an unrelated reason.
 */
function attribute(
  negatives: FeedbackEvent[],
  positives: FeedbackEvent[],
  subjectMatches: (recipe: Recipe) => boolean,
  household: Household,
): { personId: string; personName: string } | null {
  // If someone has said outright that they don't like this, use that. Inference
  // exists because explicit signal is usually missing — never to override it.
  const stated = negatives.filter((e) => {
    if (!e.personId) return false;
    try {
      return subjectMatches(getRecipe(e.recipeId));
    } catch {
      return false;
    }
  });
  const statedBy = new Set(stated.map((e) => e.personId!));
  if (statedBy.size === 1) {
    const id = [...statedBy][0];
    const person = household.people.find((p) => p.id === id);
    if (person && stated.length >= 2) {
      return { personId: person.id, personName: person.name };
    }
  }

  const relevant = negatives.filter((e) => {
    try {
      return subjectMatches(getRecipe(e.recipeId));
    } catch {
      return false;
    }
  });
  if (relevant.length < MIN_EVIDENCE) return null;

  // Attendance has to have been recorded on every one of them.
  if (!relevant.every((e) => e.attendeeIds && e.attendeeIds.length > 0)) return null;

  const alwaysPresent = household.people.filter((person) =>
    relevant.every((e) => e.attendeeIds!.includes(person.id)),
  );

  // No contrast: everyone ate together every time, so this proves nothing
  // about any individual.
  if (alwaysPresent.length === household.people.length) return null;
  if (alwaysPresent.length !== 1) return null;

  const candidate = alwaysPresent[0];

  const enjoyedIt = positives.some((e) => {
    const relevantToThem =
      e.personId === candidate.id || (!e.personId && e.attendeeIds?.includes(candidate.id));
    if (!relevantToThem) return false;
    try {
      return subjectMatches(getRecipe(e.recipeId));
    } catch {
      return false;
    }
  });
  if (enjoyedIt) return null;

  return { personId: candidate.id, personName: candidate.name };
}

/** Evidence older than this stops counting. Tastes change, especially children's. */
const EVIDENCE_WINDOW_DAYS = 120;

function recent(events: FeedbackEvent[], now = new Date()): FeedbackEvent[] {
  const cutoff = now.getTime() - EVIDENCE_WINDOW_DAYS * 86400_000;
  return events.filter((e) => {
    const t = Date.parse(e.at);
    return Number.isFinite(t) && t >= cutoff;
  });
}

function negative(e: FeedbackEvent): boolean {
  return e.type === 'rejected' || e.type === 'disliked';
}

function tally<T extends string>(
  events: FeedbackEvent[],
  extract: (recipe: Recipe) => readonly T[],
): Map<T, number> {
  const counts = new Map<T, number>();
  for (const event of events) {
    let recipe: Recipe;
    try {
      recipe = getRecipe(event.recipeId);
    } catch {
      continue; // recipe removed from the book since
    }
    for (const key of extract(recipe)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Turn raw feedback into proposals, strongest first.
 *
 * Proposals already reflected in the household's settings are filtered out, so
 * accepting one makes it stop being suggested rather than the user having to
 * dismiss the same idea every week.
 */
export function proposeRules(
  events: FeedbackEvent[],
  household: Household,
  now = new Date(),
): RuleProposal[] {
  const window = recent(events, now);
  const bad = window.filter(negative);
  const good = window.filter((e) => e.type === 'liked');
  const proposals: RuleProposal[] = [];

  const blocked = new Set(household.blockedRecipeIds ?? []);
  const dislikedTags = new Set(household.people.flatMap((p) => p.dietary.dislikedTags));
  const dislikedIngredients = new Set(
    household.people.flatMap((p) => p.dietary.dislikedIngredients),
  );

  // --- individual dishes -------------------------------------------------
  const perRecipe = new Map<string, number>();
  for (const e of bad) perRecipe.set(e.recipeId, (perRecipe.get(e.recipeId) ?? 0) + 1);

  for (const [recipeId, count] of perRecipe) {
    if (count < MIN_EVIDENCE || blocked.has(recipeId)) continue;
    let name: string;
    try {
      name = getRecipe(recipeId).name;
    } catch {
      continue;
    }
    proposals.push({
      id: `block-recipe:${recipeId}`,
      kind: 'block-recipe',
      subject: recipeId,
      suggestion: `Stop suggesting ${name}?`,
      evidence: `Swapped out ${count} times in the last few months.`,
      strength: count,
    });
  }

  // --- cuisines ----------------------------------------------------------
  const cuisineCounts = tally<Cuisine>(bad, (r) => [r.cuisine]);
  for (const [cuisine, count] of cuisineCounts) {
    if (count < MIN_EVIDENCE + 1) continue; // a whole cuisine needs more proof
    proposals.push({
      id: `avoid-cuisine:${cuisine}`,
      kind: 'avoid-cuisine',
      subject: cuisine,
      suggestion: `Serve less ${cuisine} food?`,
      evidence: `${count} ${cuisine} dishes swapped out, across different recipes.`,
      strength: count,
    });
  }

  // --- styles of cooking -------------------------------------------------
  const tagCounts = tally<RecipeTag>(bad, (r) => r.tags);
  for (const [tag, count] of tagCounts) {
    if (count < MIN_EVIDENCE + 1 || dislikedTags.has(tag)) continue;
    const who = attribute(bad, good, (r) => r.tags.includes(tag), household);
    if (who && personDislikesTag(household, who.personId, tag)) continue;
    proposals.push({
      id: `avoid-tag:${tag}${who ? `:${who.personId}` : ''}`,
      kind: 'avoid-tag',
      subject: tag,
      personId: who?.personId,
      personName: who?.personName,
      suggestion: who
        ? `Fewer ${tag.replace('-', ' ')} dishes when ${who.personName} is eating?`
        : `Fewer ${tag.replace('-', ' ')} dishes?`,
      evidence: who
        ? `${count} swapped out, all with ${who.personName} at the table.`
        : `${count} swapped out in the last few months.`,
      strength: count,
    });
  }

  // --- ingredients -------------------------------------------------------
  // Only counts when the ingredient shows up across *different* recipes,
  // otherwise this just restates "you don't like that one dish".
  const ingredientRecipes = new Map<string, Set<string>>();
  for (const event of bad) {
    let recipe: Recipe;
    try {
      recipe = getRecipe(event.recipeId);
    } catch {
      continue;
    }
    for (const ri of recipe.ingredients) {
      const set = ingredientRecipes.get(ri.ingredientId) ?? new Set<string>();
      set.add(recipe.id);
      ingredientRecipes.set(ri.ingredientId, set);
    }
  }
  for (const [ingredientId, recipeIds] of ingredientRecipes) {
    if (recipeIds.size < MIN_EVIDENCE || dislikedIngredients.has(ingredientId)) continue;
    const ingredient = getIngredient(ingredientId);
    // Staples appear everywhere; their presence carries no signal.
    if (ingredient.staple) continue;

    const who = attribute(
      bad,
      good,
      (r) => r.ingredients.some((ri) => ri.ingredientId === ingredientId),
      household,
    );
    // Already recorded against the person we'd attribute it to.
    if (who && personDislikesIngredient(household, who.personId, ingredientId)) continue;

    proposals.push({
      id: `avoid-ingredient:${ingredientId}${who ? `:${who.personId}` : ''}`,
      kind: 'avoid-ingredient',
      subject: ingredientId,
      personId: who?.personId,
      personName: who?.personName,
      suggestion: who
        ? `Keep ${ingredient.name.toLowerCase()} off ${who.personName}'s plate?`
        : `Avoid ${ingredient.name.toLowerCase()}?`,
      evidence: who
        ? `Appeared in ${recipeIds.size} dishes swapped out — and ${who.personName} was at the table for all of them.`
        : `Appeared in ${recipeIds.size} different dishes you swapped out.`,
      strength: recipeIds.size,
    });
  }

  // --- things that landed well -------------------------------------------
  const liked = new Map<string, number>();
  for (const e of good) liked.set(e.recipeId, (liked.get(e.recipeId) ?? 0) + 1);
  for (const [recipeId, count] of liked) {
    if (count < MIN_EVIDENCE) continue;
    let name: string;
    try {
      name = getRecipe(recipeId).name;
    } catch {
      continue;
    }
    proposals.push({
      id: `favour-recipe:${recipeId}`,
      kind: 'favour-recipe',
      subject: recipeId,
      suggestion: `Put ${name} into the regular rotation?`,
      evidence: `Marked as a hit ${count} times.`,
      strength: count,
    });
  }

  return proposals.sort((a, b) => b.strength - a.strength);
}

/**
 * The meals in a plan that an accepted "avoid" or "block" proposal now argues
 * against — the slots worth re-rolling so this week matches the new preference.
 *
 * A `favour-recipe` is additive (it prefers a dish, it doesn't reject any), so
 * it matches nothing here. When a proposal is attributed to one person, only
 * meals that person is actually at count — the rest of the table can still have
 * the dish.
 */
export function mealsMatchingProposal(
  plan: MealPlan,
  proposal: RuleProposal,
): PlannedMeal[] {
  return plan.meals.filter((meal) => {
    if (proposal.personId && !meal.attendeeIds.includes(proposal.personId)) return false;
    let recipe: Recipe;
    try {
      recipe = getRecipe(meal.recipeId);
    } catch {
      return false;
    }
    switch (proposal.kind) {
      case 'block-recipe':
        return recipe.id === proposal.subject;
      case 'avoid-cuisine':
        return recipe.cuisine === proposal.subject;
      case 'avoid-tag':
        return recipe.tags.includes(proposal.subject as RecipeTag);
      case 'avoid-ingredient':
        return recipe.ingredients.some((ri) => ri.ingredientId === proposal.subject);
      case 'favour-recipe':
        return false;
    }
  });
}

/**
 * Apply an accepted proposal to the household.
 *
 * Returns a new household — the caller decides whether to persist it, so an
 * accept can be undone before saving.
 */
export function applyProposal(
  household: Household,
  proposal: RuleProposal,
): Household {
  switch (proposal.kind) {
    case 'block-recipe':
      return {
        ...household,
        blockedRecipeIds: [...(household.blockedRecipeIds ?? []), proposal.subject],
      };

    case 'favour-recipe':
      return {
        ...household,
        favouredRecipeIds: [...(household.favouredRecipeIds ?? []), proposal.subject],
      };

    case 'avoid-cuisine':
      return {
        ...household,
        avoidedCuisines: [
          ...(household.avoidedCuisines ?? []),
          proposal.subject as Cuisine,
        ],
      };

    // When attribution succeeded the rule lands on one person. When it didn't,
    // it goes on everyone — which is blunt, but it's what the evidence actually
    // supports, and the settings screen is where someone narrows it down.
    case 'avoid-tag':
      return {
        ...household,
        people: household.people.map((p) =>
          proposal.personId && p.id !== proposal.personId
            ? p
            : {
                ...p,
                dietary: {
                  ...p.dietary,
                  dislikedTags: [
                    ...p.dietary.dislikedTags,
                    proposal.subject as RecipeTag,
                  ],
                },
              },
        ),
      };

    case 'avoid-ingredient':
      return {
        ...household,
        people: household.people.map((p) =>
          proposal.personId && p.id !== proposal.personId
            ? p
            : {
                ...p,
                dietary: {
                  ...p.dietary,
                  dislikedIngredients: [
                    ...p.dietary.dislikedIngredients,
                    proposal.subject,
                  ],
                },
              },
        ),
      };
  }
}

function personDislikesIngredient(
  household: Household,
  personId: string,
  ingredientId: string,
): boolean {
  const person = household.people.find((p) => p.id === personId);
  return person?.dietary.dislikedIngredients.includes(ingredientId) ?? false;
}

function personDislikesTag(
  household: Household,
  personId: string,
  tag: RecipeTag,
): boolean {
  const person = household.people.find((p) => p.id === personId);
  return person?.dietary.dislikedTags.includes(tag) ?? false;
}

export interface DishVerdict {
  recipeId: string;
  /** People who have said they like it. */
  likedBy: string[];
  /** People who have said they don't. */
  dislikedBy: string[];
  /** People who were down to eat it but didn't. Not a taste verdict. */
  missedBy: string[];
  /** Everyone eating liked it and nobody objected. */
  universal: boolean;
}

/**
 * Who likes what, from explicit verdicts only.
 *
 * Inference is fine for nudging suggestions; it is not good enough to tell
 * someone "Katie loves this". Only what people actually said counts here.
 */
export function dishVerdicts(
  events: FeedbackEvent[],
  household: Household,
): DishVerdict[] {
  const byRecipe = new Map<
    string,
    { liked: Set<string>; disliked: Set<string>; missed: Set<string> }
  >();

  for (const event of events) {
    if (!event.personId) continue;
    if (event.type !== 'liked' && event.type !== 'disliked' && event.type !== 'missed') continue;
    const entry =
      byRecipe.get(event.recipeId) ??
      { liked: new Set<string>(), disliked: new Set<string>(), missed: new Set<string>() };
    // The most recent signal wins, and the three are mutually exclusive: a
    // person who ate and rated it can't also have missed it, and vice versa.
    entry.liked.delete(event.personId);
    entry.disliked.delete(event.personId);
    entry.missed.delete(event.personId);
    if (event.type === 'liked') entry.liked.add(event.personId);
    else if (event.type === 'disliked') entry.disliked.add(event.personId);
    else entry.missed.add(event.personId);
    byRecipe.set(event.recipeId, entry);
  }

  return [...byRecipe].map(([recipeId, { liked, disliked, missed }]) => ({
    recipeId,
    likedBy: [...liked],
    dislikedBy: [...disliked],
    missedBy: [...missed],
    // "Everyone loves this" needs the whole household to have said so, not just
    // an absence of complaints.
    universal:
      disliked.size === 0 &&
      household.people.length > 0 &&
      household.people.every((p) => liked.has(p.id)),
  }));
}

/** Recipes this person has said they like. */
export function favouritesFor(events: FeedbackEvent[], personId: string): string[] {
  const verdicts = new Map<string, boolean>();
  for (const e of events) {
    if (e.personId !== personId) continue;
    if (e.type === 'liked') verdicts.set(e.recipeId, true);
    if (e.type === 'disliked') verdicts.set(e.recipeId, false);
  }
  return [...verdicts].filter(([, liked]) => liked).map(([id]) => id);
}

/** Protein mix over cooked weeks — feeds the "what changed" summary. */
export function proteinMix(events: FeedbackEvent[]): Map<ProteinClass, number> {
  return tally<ProteinClass>(
    events.filter((e) => e.type === 'cooked'),
    (r) => r.proteins,
  );
}
