import { useState } from 'react';
import type { Person } from '../../core/types.js';

export type Verdict = 'liked' | 'disliked' | 'missed';

interface Props {
  /** People who were down to eat it — only they get a say. */
  people: Person[];
  /** Their current verdict, if any, so a rating reads back its state. */
  verdictOf: (personId: string) => Verdict | undefined;
  /** One tap records it immediately. */
  onRate: (personId: string, verdict: Verdict) => void;
}

/**
 * "How was it?" — the whole point of this component is that rating costs one
 * tap per person, at a moment that already exists: a meal that's just been
 * eaten, or a recipe someone's just finished cooking. It's inline, never a
 * modal, and dismissable, because a prompt you can't wave away is one people
 * learn to resent.
 *
 * A meal doesn't always happen. "Missed" captures that plainly — per person for
 * the one who was out, or in one tap for the whole table when the plan didn't
 * survive the day. It's kept separate from liking: not eating something is not
 * a verdict on it.
 */
export function MealRating({ people, verdictOf, onRate }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || people.length === 0) return null;

  const allMissed = people.every((p) => verdictOf(p.id) === 'missed');

  return (
    <div className="rate">
      <div className="rate__head">
        <span className="rate__q">How was it?</span>
        <button
          className="rate__all-missed"
          aria-pressed={allMissed}
          onClick={() => people.forEach((p) => onRate(p.id, 'missed'))}
        >
          Nobody ate it
        </button>
      </div>
      <div className="rate__people">
        {people.map((person) => {
          const verdict = verdictOf(person.id);
          return (
            <span className="rate__person" key={person.id}>
              <span className="rate__name">{person.name}</span>
              <button
                className={`chip ${verdict === 'liked' ? 'chip--good' : ''}`}
                aria-pressed={verdict === 'liked'}
                aria-label={`${person.name} liked it`}
                onClick={() => onRate(person.id, 'liked')}
              >
                Liked
              </button>
              <button
                className={`chip ${verdict === 'disliked' ? 'chip--on' : ''}`}
                aria-pressed={verdict === 'disliked'}
                aria-label={`${person.name} didn't`}
                onClick={() => onRate(person.id, 'disliked')}
              >
                Not for me
              </button>
              <button
                className={`chip ${verdict === 'missed' ? 'chip--missed' : ''}`}
                aria-pressed={verdict === 'missed'}
                aria-label={`${person.name} missed it`}
                onClick={() => onRate(person.id, 'missed')}
              >
                Missed
              </button>
            </span>
          );
        })}
      </div>
      <button className="rate__dismiss" onClick={() => setDismissed(true)}>
        Dismiss
      </button>
    </div>
  );
}
