# Family meal planner

Generates a week of meals for one specific household, respecting that
household's own rules, and turns it into a shopping list you can actually shop
from.

The premise: recipes are a commodity and nobody needs another recipe site. What
nobody sells well is *"respect these fifteen idiosyncratic household rules,
every week, forever."* That constraint engine is the product. Everything else
here exists to serve it.

Runs as a website, and ships to the App Store and Play Store via Capacitor —
one codebase, no fork. See **MOBILE.md**.

```bash
npm install
npm run dev        # the app in a browser
npm run ios        # build, sync and open Xcode
npm run android    # build, sync and open Android Studio
npm test           # 40 headless engine tests, no browser needed
npm run plan 42    # generate and print a week in the terminal
```

---

## Architecture

```
src/core/          pure TypeScript — no React, no DOM, runs in Node
  types.ts         domain model
  units.ts         unit conversion and quantity arithmetic
  data/            120 built-in recipes, 166 ingredients, household
    registry.ts    merges built-ins with the household's own dishes
  recipes/validate.ts  save-time checks for user-authored recipes
  recipes/scale.ts     recipe as read at the hob, scaled to tonight's portions
  pantry/pantry.ts     what you already have, subtracted from the list
  people/profile.ts    one person's week, derived from the plan
  people/goals.ts      eating emphasis without calorie counting
  rules/
    hard.ts        absolute constraints — never traded away
    soft.ts        weighted preferences — the solver's objective function
    config.ts      every tunable number in one place
  planner/solver.ts      constraint-satisfying scheduler
  planner/feasibility.ts pre-flight check: can these rules be satisfied at all?
  planner/leftovers.ts   planned-overs: cook once, eat twice
  planner/reconcile.ts   keeps a plan honest when attendance changes
  learning/feedback.ts   turns swaps into proposed rules
  onboarding/questions.ts  five questions, then let behaviour do the rest
  shopping/list.ts   aggregation, scaling, pack rounding
  diet/screen.ts     advisory allergen screening
  basket/            the seam where this meets a supermarket
    manual.ts        rung 1 — copy the list
    deeplink.ts      rung 2 — hand off to a retailer's own search
src/app/           React shell — thin, all logic lives in core
src/store/         persistence (native Preferences / localStorage) + undo stack
src/app/useNative.ts  back button, status bar, haptics — all optional
src/app/components/TabBar.tsx   bottom navigation
src/app/components/Shell.tsx    lets a panel be a page or a sheet
tests/             headless engine tests
```

**The core has no React dependency.** That's the load-bearing decision. It
means the rule engine is testable without a browser, and can move server-side
unchanged when basket integration needs somewhere to keep credentials.

---

## Five decisions worth defending

### 1. Recipes are curated data, not model output

A language model will happily invent a cook time and a quantity, and a family
notices within one week. The model's role in this product is assembly and
explanation — never inventing the thing you'll be standing over a hob trusting.
Adding a recipe is one object in `data/recipes.ts` with no logic, so it stays a
five-minute job for someone who doesn't write code.

### 2. Hard rules and soft rules are different things

The original spec had "no aubergine" and "use a traybake once a week" in one
list. An LLM will treat those as roughly equally negotiable. Here they're
separate mechanisms:

- **Hard rules** (`rules/hard.ts`) prune the candidate set before a dish is ever
  placed. Dietary exclusions, no fish on Friday, time budgets, kids-can-cook-it
  when the adults are out. A rule that can be traded away for a better overall
  score is not a hard rule.
- **Soft rules** (`rules/soft.ts`) score a whole plan 0–1 and are weighted
  against each other.

### 3. When rules collide, the app says so

Fish 2–3 times but never Friday to Sunday leaves four eligible evenings. Add a
weekly steak, no repeated cuisine on consecutive days, and a coeliac diner, and
some weeks are genuinely infeasible.

The solver never silently drops a rule. The **rule rail** shows every rule's
live status, and `diagnoseUnfilled()` names any slot it couldn't fill and
explains which constraint ran out of room. During development it correctly told
me the recipe book had only one gluten-free breakfast that fit a weekday time
budget — which was true, and was a content gap, not a bug.

### 4. Settings show their consequences as you type

`planner/feasibility.ts` runs before generating, not after. Tighten Tuesday to
ten minutes and the household editor tells you straight away that nothing fits
— and **which rule to relax**.

That last part matters. Rules are evaluated one-out: for each rule, count how
many dishes it alone removes, and name the one removing the most. Dropping a
rule and re-counting is more honest than guessing from a rule's name what it
probably did. So instead of "no meals fit Tuesday" you get "the time budget is
ruling out 14 dishes on its own".

There's also a variety check, which catches what the per-slot count misses:
seven Mondays' worth of options is no good if they're all the same three
dishes.

### 5. Onboarding asks five questions, not fifty

The setup screen is the riskiest surface in the product. A long form asking
someone to enumerate their household's rules is how a meal planner dies at
signup — people don't know their rules explicitly, and the ones they'd type
aren't the ones that actually govern their week.

So `onboarding/questions.ts` asks only what genuinely can't be inferred:

1. **Who eats here** — portion maths is wrong from meal one without it
2. **Hard exclusions** — the one thing that must never be learned by trial
3. **Weeknight time** — the constraint that decides whether a plan survives a
   Tuesday, and the thing people are most reliably honest about
4. **Which meals to plan** — most households only want dinners
5. **A starting lean** — one steer so week one isn't generic

One question per screen, each explaining *why* it's asked. A form shows you the
full length of the homework up front, and the count is what makes people close
the tab.

Portion factors are derived from age band rather than asked. Scoring your own
child's appetite on a 0.3–2.0 scale reads as homework, and the default is close
enough for week one.

The lean adjusts rule *weights*, not rules. A lean is a mood, not a commitment —
encoding it as a weight means it bends when it hits something real, and fades as
actual behaviour accumulates.

### 6. Rules are learned from swaps, never applied automatically

Nobody types fifteen idiosyncratic rules into an onboarding form. But people
*will* swap a meal they don't fancy, and that swap carries the same
information. `learning/feedback.ts` turns a stream of small actions into
proposals.

Two commitments hold it together:

- **Nothing applies itself.** A planner that quietly rewrites its own rules is
  one you can't predict, and predictability is most of what makes a weekly
  routine stick. Proposals surface as questions; the household decides.
- **Every proposal shows its evidence.** "Swapped out 3 times in the last few
  months" is checkable. "We think you dislike this" is not.

**Whose preference is it?** A rule learned from household behaviour is useless
if it bans mushrooms for four people because one person doesn't like them. So
every feedback event records who was at the table, and attribution requires two
things:

1. The person was present at **every** negative event about that subject.
2. There is **contrast** — at least one household member who missed at least
   one of those meals.

Without contrast, everyone qualifies and the test has proved nothing. In that
case the honest answer is "we can't tell", and the proposal stays
household-wide rather than inventing a fact. Missing attendance data produces
no attribution either. A recorded "went down well" rules a person out, since
enjoying something outweighs being present when it was swapped for an unrelated
reason.

The payoff is that an attributed dislike only costs score on meals that person
actually attends — the dish stays available on the days they're out.

Three strikes minimum, because two is a coincidence — a busy Tuesday, a dish
that clashed with something else that week. Evidence ages out after four months,
since tastes change and children's change fastest. Staples are excluded from
ingredient inference: olive oil appears in everything, so its presence in a
rejected dish means nothing.

### 7. Changing who's eating repairs, it never regenerates

Attendance is the thing that actually moves week to week. Someone's out
Thursday, a child's home for lunch. A planner that makes you regenerate the
whole week to absorb that is one people stop updating.

`planner/reconcile.ts` splits the two consequences, because they deserve
different treatment:

- **Portions go stale.** Arithmetic. Fixed immediately and silently.
- **Meals can become illegal.** Thursday's dish was fine with an adult at the
  table; with only children it may not be. *Reported, never silently swapped* —
  the household chose that dish and may already have shopped for it.

`repairPlan()` then re-rolls only the broken slots with everything else pinned,
and returns a from/to for each change so the swap can be explained rather than
just happening. Rewriting Monday because Thursday changed is precisely the
behaviour that makes a planner untrustworthy.

### 8. Planned-overs are a decision, not an accident

Most planners offer to "minimise leftovers". Leftovers are something you manage
after the fact; a planned-over is a choice to cook Sunday big enough to cover
Monday, and it's the single biggest reduction in weeknight cooking available.

This forced a distinction in the rule engine that turned out to matter. Some
hard rules are about **the act of cooking** — a time budget and a repeat limit
are meaningless for food already in the fridge. Others are about **the food** —
an allergen is still an allergen on Tuesday. Each hard rule now declares
`appliesToPlannedOvers`, and getting that split wrong either blocks every
planned-over or carries a dish to someone who can't eat it. The test suite pins
both directions.

### 9. Two rules need memory, so persistence is architectural

"No repeated pasta style within a fortnight" and "don't repeat recent dinners"
read from cooking history. Without persistence they can never fire and the
planner quietly degrades into a random recipe picker. History is written when a
week is marked as cooked, not when it's generated — a plan you never cooked
shouldn't block a dish next week.

### 10. Undo is a snapshot stack, not an operation log

Almost every feature here is one-way: accepting a suggestion, repairing a
broken meal, toggling someone out of a dinner. Individually each is small;
together they make people cautious, and a planner people are cautious with is
one they use less.

`store/undo.ts` snapshots state rather than logging invertible operations. The
state is small — a household and a week of meals — so snapshots are cheap, they
can't drift out of sync with the operations that produced them, and **adding a
new mutating feature needs no corresponding "how do I reverse this" code**.
That last point is the real argument: reverse-operation logic is exactly the
kind of thing that gets forgotten on the seventh feature and ships broken.

Labels are user-facing, because "Undo retiring Spaghetti bolognese" tells you
what you're getting back and "Undo action" does not.

### 11. User recipes go through the same checks the built-ins get

The built-in book is guarded by the test suite: ingredient references resolve,
units reconcile, hands-on time never exceeds total time. A recipe someone types
in gets none of that protection, so `recipes/validate.ts` runs the same checks
at save time. Otherwise the first symptom of a bad recipe is a crash halfway
through building a shopping list on a Sunday evening.

Ingredients are **picked from the catalogue, never typed free-form**. A
free-text ingredient is one the shopping list can't buy and the allergen screen
can't see, which quietly breaks the two features that matter most.

Problems are split by severity. An `error` would break something downstream and
blocks saving. A `warning` is a judgement call — no protein set means the dish
counts against "protein at every meal", which is worth knowing but is the
author's call to make.

User recipes shadow built-ins with the same id, so "we make the bolognese
differently" works without forking the catalogue. Clearing them restores the
original.

### 12. The recipe is scaled before you read it

The reason to read a recipe here rather than on a website is that the app knows
how many portions are needed tonight. Two children eating a dish written for
four should see quantities for two — not the original numbers and a note to do
the arithmetic while holding a knife.

Two rules make the scaling trustworthy:

- **Fixed items don't scale.** Oil for the pan and a pinch of salt stay put; a
  tablespoon doesn't become half a tablespoon because fewer people are eating.
- **Weights keep their precision, countables round to halves.** 145g of tuna is
  a real instruction and rounding it to 150g defeats the point. But "1.33
  onions" is not actionable, so countables land on a half or a whole and never
  round down to nothing.

The view assumes a phone propped against something, at arm's length, with wet
hands: large type, tappable ingredients and steps that stay struck through so
you can find your place after an interruption. Allergen warnings appear here too,
in the same advisory wording used everywhere else.

### 13. The pantry never tries to know what's in the cupboard

Every pantry feature dies the same way: it asks people to log what they use.
Nobody opens an app after finishing the rice. Within a fortnight the stored
inventory is wrong, and a wrong inventory is *worse than none* — it silently
removes things from your list that you don't actually have, and you find out in
the kitchen.

So this stores no inventory. It offers two things people will genuinely
maintain:

1. **Always stocked** — a short list of things you simply always have. Set once,
   changes twice a year.
2. **Got it this week** — ticked while reviewing the list before a shop, and
   **wiped when the week turns over**.

The expiry is the load-bearing part. Because weekly ticks can't outlive the week
they were entered for, being wrong costs one shop instead of compounding
forever. `pantryForWeek()` does the wiping, and there's a test pinning it.

Partial amounts reduce a line rather than removing it — 250g of rice in the jar
against 400g needed leaves 150g on the list, re-rounded to whole packs rather
than just relabelled. And removals are always *visible*: a list that quietly
drops an item is one you stop trusting the first time you get home without
something.

Ticking happens on the shopping list itself, not a separate pantry screen. It's
the one moment someone is already thinking about whether they have each thing;
a dedicated screen is a screen nobody visits.

### 14. A household is not a unit

The week view answers "what is the household eating?" — the right default, and
it hides something important. A child on packed lunches sees a completely
different week from the parent cooking dinner, and **repetition is invisible
day by day** because each day looks fine on its own.

`people/profile.ts` builds one person's week: the meals they're actually at,
the ones they miss, their protein and cuisine mix, and their rules **with this
week's status attached**. A settings screen tells you what a rule says; this
tells you whether it's being kept, which is the only version anyone cares about
and previously required reading all 21 meals yourself.

The headline does most of the work. "Jack eats 16 meals at home, away for 5,
across 16 different dishes" is reassuring; "only 4 different dishes" is the
sentence that makes you open the swap sheet. Suggestions attributed to a person
surface here too, next to the week that produced them.

Everything is derived — no per-person state is stored, so this view can never
disagree with the plan it describes.

### 15. Eating goals, without a calorie counter

Someone wanting more protein should get more protein-forward meals. That does
not require calorie tracking, and this app deliberately doesn't do it.

There's no nutrition data here — no calories, no macros, nothing per 100g. It
could be added, but a figure like "42g protein" derived from recipe tags would
be invented precision, and people make real decisions on numbers like that. So
a goal does two honest things instead: it nudges the planner towards
protein-forward meals on the days that person eats, and it adjusts their portion
factor slightly. No daily total, no target, no trend line.

`proteinWeightOf()` stays qualitative on purpose. Counting protein classes
gives a reliable *ordering* — two substantial proteins really is more
protein-forward than none — even though the underlying grams are unknown.

**Goals are adults only, structurally.** `canSetGoal()` returns false for
children and `portionFactorFor()` ignores a goal set on one, so data alone can't
route around it. A child should never open this app and see a target for their
own eating; children's portions come from age band, as they always did.

### 16. Stated verdicts beat inferred ones

The app already guessed who disliked something from who was at the table. That
inference exists because explicit signal is usually missing — never to override
it. Now the end-of-week review captures a verdict *per person per dish*, and
wherever the two disagree, what someone actually said wins.

Two details that keep "everyone loves it" meaningful:

- **Silence is not approval.** A dish is only universal when every diner has
  said they liked it, not when nobody complained.
- **A later verdict replaces an earlier one**, because people change their
  minds, and a stale dislike is worse than no data.

### 17. Time budget beats cuisine rotation

`maxActiveMinutes` per slot is the constraint that decides whether a plan
survives contact with a Tuesday. Cuisine rotation is a nice-to-have; a
40-minute recipe on a 20-minute evening is why people abandon meal planners in
February.

---

## Allergens are advisory

**Every string this app produces says "contains", never "safe for".** That
distinction is the whole ballgame.

The dietary screen reads this app's own ingredient catalogue. It cannot see:

- **reformulation** — recipes change and cached data goes stale silently
- **"may contain" warnings** — voluntary and unstandardised, so their absence
  means nothing
- **cross-contamination** — for coeliac disease and any true allergy this is
  the actual risk, and it is invisible from an ingredient list
- **substitutions** — the single biggest hazard. Order gluten-free pasta, the
  picker substitutes regular pasta, and the entire safety layer is bypassed
  after the app has stopped being involved

This is why the solver treats exclusions as absolute while the UI *still* shows
the badge, and why flagged items in the basket adapter are held for human
confirmation rather than added automatically.

---

## The road to a filled basket

There is currently no sanctioned way to fill a UK grocery basket from a
third-party app. Tesco's public developer portal stopped issuing subscriptions
years ago; the commercial "grocery APIs" on the market are read-only scrapers;
and the retailers' own ordering flows are closed because they all compete for
the same delivery customer.

The ladder, with `BasketAdapter` as the swap point:

| Rung | Approach | Status |
|---|---|---|
| 1 | Copy / export list | **built** (`basket/manual.ts`) |
| 2 | Deep links into store search | **built** (`basket/deeplink.ts`) — Tesco, Sainsbury's, Ocado, Waitrose |
| 3 | Affiliate or partner basket handoff | needs a commercial agreement |

Rung 2 opens one search tab per item. That is a real improvement on typing and
it is honestly not the seamless thing — the UI says so rather than pretending
otherwise. Search URLs are stable and permitted; nothing breaks when a private
endpoint changes.

A privacy note on rung 2: search terms are built from the ingredient name and
pack size only. Nothing about the household ever enters a third-party URL, and
there's a test that fails if it does.

Reverse-engineered basket endpoints are the tempting shortcut and the wrong
one: a permanent maintenance treadmill against people actively trying to stop
you, plus terms-of-service violations that make the thing unfundable and
unacquirable. Shoppable-recipe partnerships are a real category — Whisk did
exactly this with Sainsbury's — but you won't get one at zero users. Hence
rung 1 now, and an interface designed so rung 3 touches exactly one file.

---

## Safety and accessibility review

A dedicated pass over the whole app rather than a feature. What it found:

### One real crash

Deleting one of your own recipes while it was still on the current week threw
from deep inside the shopping list and **took the whole app down with a blank
screen** — the worst kind of failure, because nothing on screen says what
happened or how to recover. Same path was reachable from a stored plan
outliving a deleted recipe.

`planner/integrity.ts` now checks for orphaned meals. The app drops them on
load, leaving an empty slot the user already knows how to fill, and deleting a
recipe that's in use asks first and says how many meals it affects.

### Six modals with no keyboard route

Every sheet could only be dismissed by clicking the backdrop or finding Close
with a mouse. A keyboard user who opened one was stuck; focus could tab out
behind an open dialog. `app/useModal.ts` adds Escape-to-close, focus capture
and restore, and scroll locking, to all six at once.

### Wording held up

Every allergen string across the diet screen, the cook view and the person view
says "contains … check the pack". No instance of "safe for" anywhere in the
codebase. That was the thing most worth getting right and it had held.

### Usability

- **Navigation is a bottom tab bar.** The first version had six equal buttons
  across the top; collapsing them into a **More** menu fixed the visual noise
  and immediately created a worse problem — a first user couldn't find the
  profile screen at all. Five labelled tabs at the bottom put everything one tap
  away, visible without exploring, and within thumb reach on a phone. Five is
  the ceiling: a sixth makes labels illegible at phone widths.
- **The empty state said nothing useful.** It now explains what pressing the
  button will actually do, and that everything is changeable afterwards.
- **Touch targets** are 44px minimum on touch devices via `pointer: coarse`,
  without changing how anything looks on a desktop.

## A note on solver performance

Solve time is roughly `restarts × slots × candidates × rules`. At 120 recipes a
week takes about 1.5 seconds, up from 250ms at 34. Still fine, but it grows
linearly with the book and the obvious fix when it stops being fine is to cache
per-slot candidate lists across restarts rather than re-filtering.

## What isn't built yet

- **Redo in the UI** — the stack supports it; there's no button yet
- **Server-side core** — needed before any credentialled integration

---

## Testing

`npm test` runs 236 assertions across two suites with no framework and no browser. The ones worth
knowing about:

- no gluten reaches the coeliac diner when they're present
- no fish lands on a Friday, Saturday or Sunday evening
- the adult-free evening gets a dish the kids can finish
- rerolling one meal leaves every other meal untouched
- doubling portions increases the shop
- an impossible slot is *reported with a reason*, not silently dropped
- ingredient units reconcile across every recipe
- an impossible setting is caught *before* planning, with the binding rule named
- two rejections propose nothing; three propose a rule; stale evidence expires
- an accepted proposal actually changes later plans, and stops being suggested
- a planned-over does not double-buy its ingredients
- no household detail ever appears in a retailer URL
- a freshly onboarded household gets a full, legal week — including a child with
  a nut allergy getting nothing containing nuts
- a one-person household plans without portions collapsing below one
- reconciling an unchanged week is a genuine no-op, not a quiet rewrite
- a meal made illegal by an attendance change is flagged, not silently swapped
- repairing one broken meal leaves every other meal untouched
- attribution names a person when the evidence supports it, and refuses to when
  it doesn't — no contrast, no attendance data, or a recorded "liked" all block it
- a dislike never changes what is hard-allowed; a preference is not an exclusion
- undo snapshots are deep copies, so later edits can't corrupt them
- a new action clears the redo branch, so redo can never jump to a state that
  no longer follows from anything
- a user recipe with an unreconcilable unit is rejected at save time, with a
  message saying which unit to use instead
- a saved user recipe is usable end to end — planned, scaled, and shopped for
- scaling down shrinks the scalable ingredients and leaves the fixed ones alone
- a countable ingredient never rounds down to zero
- a new week wipes the weekly pantry ticks but keeps the always-stocked list
- having some of something recalculates what to buy, rather than relabelling it
- an amount in units that can't be reconciled leaves the line alone rather than
  guessing at coverage
- a person's attended and missed meals together account for the whole plan
- four dinners off one dish is called out; a varied week is not
- someone away all week gets a sensible profile rather than a broken one
- a goal set on a child has no effect on their portion, and can't be offered
- a protein goal shifts the week without taking it over, and keeps it legal
- one person liking a dish is not "everyone loves it"
- an explicit verdict overrides the attendance-based guess
- deleting a recipe that's still on the plan degrades to an empty slot rather
  than crashing the app

That last one is a data-integrity test, and it earns its keep. It caught 16
real defects where an ingredient was counted in one recipe and weighed in
another — a class of bug that would otherwise surface as a crash while someone
was trying to do their shopping.
