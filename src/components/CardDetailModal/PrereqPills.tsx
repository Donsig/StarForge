import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useModal } from '../../context/ModalContext';
import type { PrereqRow } from '../../utils/cardDetails';

const styles = {
  empty: {
    fontSize: '0.73rem',
    color: 'rgba(150,180,220,0.35)',
    fontStyle: 'italic',
  },
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  pills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.3rem',
  },
  pill: {
    fontSize: '0.7rem',
    padding: '0.17rem 0.5rem',
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    userSelect: 'none',
    transition: 'background 150ms, border-color 150ms',
  },
  met: {
    border: '1px solid rgba(52,211,153,0.5)',
    background: 'rgba(52,211,153,0.08)',
    color: '#34d399',
    cursor: 'default',
  },
  unmet: {
    border: '1px solid rgba(248,113,113,0.5)',
    background: 'rgba(248,113,113,0.08)',
    color: '#f87171',
  },
  icon: {
    fontSize: '0.65rem',
    opacity: 0.7,
  },
  toast: {
    fontSize: '0.7rem',
    color: '#f87171',
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.3rem 0.55rem',
    background: 'rgba(248,113,113,0.08)',
    border: '1px solid rgba(248,113,113,0.25)',
    borderRadius: 6,
  },
  toastLabel: {
    color: '#fca5a5',
    fontWeight: 700,
  },
} satisfies Record<string, CSSProperties>;

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
    return <span style={styles.empty}>No prerequisites</span>;
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
    <div style={styles.root}>
      <div style={styles.pills}>
        {rows.map((row) => {
          const clickable = !row.met && row.target !== null;
          const stateStyle = row.met ? styles.met : { ...styles.unmet, cursor: clickable ? 'pointer' : 'default' };

          return (
            <span
              key={row.label}
              role={clickable ? 'button' : undefined}
              title={clickable ? `Go to ${row.label}` : undefined}
              onClick={() => navigateTo(row)}
              style={{ ...styles.pill, ...stateStyle }}
            >
              <span>{row.label}</span>
              {clickable ? <span aria-hidden="true" style={styles.icon}>↗</span> : null}
            </span>
          );
        })}
      </div>

      {navigatingTo !== null ? (
        <div style={styles.toast}>
          <span aria-hidden="true" style={styles.icon}>↗</span>
          <span>
            Navigating to <span style={styles.toastLabel}>{navigatingTo}</span>…
          </span>
        </div>
      ) : null}
    </div>
  );
}
