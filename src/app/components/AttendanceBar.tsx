import { useState } from 'react';
import { DAY_NAMES } from '../../core/rules/context.js';
import type { DayIndex, Household, MealSlot } from '../../core/types.js';

interface Props {
  day: DayIndex;
  household: Household;
  onToggle: (personId: string, day: DayIndex, slot: MealSlot) => void;
}

/**
 * "We're out Thursday" in one tap, on the screen where you noticed.
 *
 * Attendance is the thing that actually changes week to week, and burying it in
 * a settings modal means people either regenerate the whole week or stop
 * updating it at all. Both are worse than a slightly busier day row.
 *
 * Collapsed by default so the week stays scannable — the control only earns
 * its space at the moment someone needs it.
 */
export function AttendanceBar({ day, household, onToggle }: Props) {
  const [open, setOpen] = useState(false);

  const slots = household.plannedSlots;
  const awayCount = household.absences.filter((a) => a.day === day).length;

  if (!open) {
    return (
      <button
        className="attendance__toggle"
        onClick={() => setOpen(true)}
        aria-expanded="false"
      >
        {awayCount === 0 ? 'Everyone in' : `${awayCount} away`}
      </button>
    );
  }

  return (
    <div className="attendance">
      <div className="attendance__head">
        <span className="field__hint" style={{ margin: 0 }}>
          Who's eating on {DAY_NAMES[day]}
        </span>
        <button
          className="btn btn--ghost"
          onClick={() => setOpen(false)}
          aria-expanded="true"
        >
          Done
        </button>
      </div>

      {slots.map((slot) => (
        <div className="attendance__row" key={slot}>
          <span className="attendance__slot">{slot}</span>
          <div className="chips">
            {household.people.map((person) => {
              const away = household.absences.some(
                (a) => a.personId === person.id && a.day === day && a.slot === slot,
              );
              return (
                <button
                  key={person.id}
                  className={`chip ${away ? 'chip--away' : 'chip--in'}`}
                  aria-pressed={!away}
                  aria-label={`${person.name} ${away ? 'away for' : 'eating'} ${DAY_NAMES[day]} ${slot}`}
                  onClick={() => onToggle(person.id, day, slot)}
                >
                  {person.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
