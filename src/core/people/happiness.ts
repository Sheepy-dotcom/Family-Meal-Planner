import { getRecipe } from '../data/registry.js';
import { dishVerdicts } from '../learning/feedback.js';
import type { FeedbackEvent } from '../learning/feedback.js';
import type { Household, MealPlan } from '../types.js';

/**
 * "Is everyone happy?"
 *
 * A household isn't one palate, and a plan that averages well can still quietly
 * leave one person eating around the edges every week. Every other planner
 * answers "what's for dinner?"; this answers the question a family actually
 * carries — is each person getting enough they like, and is anything they've
 * said no to still landing on their plate?
 *
 * It only ever speaks from what people have actually said. Explicit likes and
 * dislikes, and whether a disliked dish is on *this* week's plan for someone who
 * has to eat it — those are checkable. Where there's no signal it says so ("no
 * word yet") rather than inventing contentment. Nothing here changes the plan;
 * it surfaces, the household decides.
 */

export type HappinessStatus = 'happy' | 'mixed' | 'attention' | 'quiet';

export interface PersonHappiness {
  personId: string;
  name: string;
  /** Distinct dishes they've said they like / dislike, recently. */
  liked: number;
  disliked: number;
  status: HappinessStatus;
  /** One plain sentence, safe to show as-is. */
  headline: string;
}

export interface HouseholdHappiness {
  people: PersonHappiness[];
  /** A household-level read, most-actionable first. */
  headline: string;
}

/** Tastes change; only the last few months count toward a happiness read. */
const WINDOW_DAYS = 120;

function nameOf(recipeId: string): string | null {
  try {
    return getRecipe(recipeId).name;
  } catch {
    return null;
  }
}

/**
 * Read each person's happiness from explicit verdicts and this week's plan.
 * `plan` is optional — without it the read is purely about what's been said;
 * with it, a dislike still on the menu becomes the thing worth flagging.
 */
export function householdHappiness(
  events: FeedbackEvent[],
  household: Household,
  plan?: MealPlan | null,
  now: Date = new Date(),
): HouseholdHappiness {
  const cutoff = now.getTime() - WINDOW_DAYS * 86400_000;
  const recent = events.filter((e) => {
    const t = Date.parse(e.at);
    return Number.isFinite(t) && t >= cutoff;
  });
  const verdicts = dishVerdicts(recent, household);

  const people = household.people.map((person): PersonHappiness => {
    const likedIds = verdicts.filter((v) => v.likedBy.includes(person.id)).map((v) => v.recipeId);
    const dislikedIds = verdicts
      .filter((v) => v.dislikedBy.includes(person.id))
      .map((v) => v.recipeId);
    const liked = likedIds.length;
    const disliked = dislikedIds.length;

    // The most actionable thing: a dish they've turned down that they're still
    // down to eat this week.
    const dislikedOnPlan = plan?.meals.find(
      (m) => m.attendeeIds.includes(person.id) && dislikedIds.includes(m.recipeId),
    );
    // A favourite already on the menu is worth saying out loud too.
    const favouriteOnPlan = plan?.meals.find(
      (m) => m.attendeeIds.includes(person.id) && likedIds.includes(m.recipeId),
    );

    let status: HappinessStatus;
    let headline: string;

    if (dislikedOnPlan) {
      const dish = nameOf(dislikedOnPlan.recipeId);
      status = 'attention';
      headline = dish
        ? `${person.name} didn't like ${dish}, and it's on this week — worth a swap.`
        : `A dish ${person.name} didn't like is on this week — worth a swap.`;
    } else if (liked === 0 && disliked === 0) {
      status = 'quiet';
      headline = `No word from ${person.name} yet — a few taps of "how was it?" and this fills in.`;
    } else if (disliked === 0) {
      status = 'happy';
      const fav = favouriteOnPlan ? nameOf(favouriteOnPlan.recipeId) : null;
      headline = fav
        ? `${person.name}'s a fan of ${liked} dish${liked === 1 ? '' : 'es'} — and ${fav} is on this week.`
        : `${person.name}'s liked ${liked} dish${liked === 1 ? '' : 'es'} and turned none down.`;
    } else {
      status = 'mixed';
      const fav = favouriteOnPlan ? nameOf(favouriteOnPlan.recipeId) : null;
      headline = fav
        ? `${person.name}'s a mix of hits and misses — ${fav} this week is one they like.`
        : `${person.name}'s liked ${liked} and passed on ${disliked} — a normal mix.`;
    }

    return { personId: person.id, name: person.name, liked, disliked, status, headline };
  });

  return { people, headline: householdHeadline(people) };
}

function householdHeadline(people: PersonHappiness[]): string {
  if (people.length === 0) return 'Add someone to see how the household is doing.';

  const attention = people.filter((p) => p.status === 'attention');
  if (attention.length > 0) {
    const names = joinNames(attention.map((p) => p.name));
    return `${names} ${attention.length === 1 ? 'has' : 'have'} a dish on this week they'd said no to.`;
  }

  if (people.every((p) => p.status === 'quiet')) {
    return 'No ratings yet — tap "how was it?" on a few meals and this shows how everyone\'s doing.';
  }

  if (people.some((p) => p.status === 'mixed')) {
    return 'A normal mix of hits and misses — no one\'s being left out.';
  }

  return "Everyone's getting a fair look-in this week.";
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
