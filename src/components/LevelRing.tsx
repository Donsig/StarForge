interface LevelRingProps {
  level: number;
  maxLevel?: number;
  size?: number;
  color?: string;
}

export function LevelRing({
  level,
  maxLevel = 20,
  size = 36,
  color = '#4d8fff',
}: LevelRingProps) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const normalizedLevel = maxLevel > 0 ? Math.min(1, Math.max(0, level / maxLevel)) : 0;

  return (
    <div className="level-ring" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        style={{ transform: 'rotate(-90deg)', color }}
      >
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.15"
          strokeWidth="2.5"
        />
        {level > 0 && (
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - normalizedLevel)}
            strokeLinecap="round"
          />
        )}
      </svg>
      <span className="level-ring__value">{level}</span>
    </div>
  );
}
