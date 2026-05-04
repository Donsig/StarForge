import { useEffect, useRef, useState } from 'react';
import { useModal } from '../../context/ModalContext';
import type { PrereqRow } from '../../utils/cardDetails';

export function PrereqPills({ rows }: { rows: PrereqRow[] }) {
  const { open } = useModal();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (rows.length === 0) {
    return <span className="prereq-pills__empty">No prerequisites</span>;
  }

  const navigateTo = (row: PrereqRow) => {
    if (row.met || row.target === null) {
      return;
    }

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    setNavigatingTo(row.label);
    timerRef.current = setTimeout(() => {
      if (row.target !== null) {
        open(row.target.type, row.target.id);
      }
      timerRef.current = null;
    }, 150);
  };

  return (
    <div className="prereq-pills">
      <div className="prereq-pills__row">
        {rows.map((row) => {
          const clickable = !row.met && row.target !== null;
          const stateClass = row.met ? 'prereq-pill--met' : 'prereq-pill--unmet';

          return (
            <span
              key={row.label}
              role={clickable ? 'button' : undefined}
              title={clickable ? `Go to ${row.label}` : undefined}
              onClick={() => navigateTo(row)}
              className={`prereq-pill ${stateClass}${clickable ? ' prereq-pill--clickable' : ''}`}
            >
              <span>{row.label}</span>
              {clickable ? <span aria-hidden="true" className="prereq-pill__icon">↗</span> : null}
            </span>
          );
        })}
      </div>

      {navigatingTo !== null ? (
        <div className="prereq-nav-toast">
          <span aria-hidden="true" className="prereq-nav-toast__icon">↗</span>
          <span>
            Navigating to <span className="prereq-nav-toast__label">{navigatingTo}</span>…
          </span>
        </div>
      ) : null}
    </div>
  );
}
