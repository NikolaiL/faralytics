import type { CSSProperties } from "react";

const scenes = [
  [
    { x: 205, y: 94, size: 1, color: "#b596f2", rays: 12 },
    { x: 106, y: 148, size: 0.57, color: "#855dcd", rays: 10 },
    { x: 280, y: 147, size: 0.47, color: "#d6ff3f", rays: 10 },
  ],
  [
    { x: 218, y: 105, size: 1.12, color: "#b596f2", rays: 14 },
    { x: 105, y: 157, size: 0.46, color: "#d6ff3f", rays: 8 },
  ],
  [
    { x: 151, y: 115, size: 0.91, color: "#d6ff3f", rays: 10 },
    { x: 255, y: 66, size: 0.55, color: "#855dcd", rays: 14 },
  ],
  [
    { x: 220, y: 121, size: 1.06, color: "#855dcd", rays: 18 },
    { x: 112, y: 67, size: 0.59, color: "#b596f2", rays: 8 },
  ],
  [
    { x: 132, y: 100, size: 0.83, color: "#b596f2", rays: 8 },
    { x: 226, y: 151, size: 0.69, color: "#d6ff3f", rays: 12 },
    { x: 277, y: 66, size: 0.38, color: "#855dcd", rays: 10 },
  ],
  [
    { x: 177, y: 110, size: 1.15, color: "#b596f2", rays: 20 },
    { x: 269, y: 153, size: 0.51, color: "#d6ff3f", rays: 8 },
  ],
];

const confettiColors = ["#b596f2", "#855dcd", "#d6ff3f"];

export function YearReviewFireworks({
  width,
  height,
  variant = 0,
  confetti = 0,
}: {
  width?: number;
  height?: number;
  variant?: number;
  confetti?: number;
}) {
  const bursts = scenes[variant % scenes.length];
  return (
    <svg viewBox="0 0 340 220" width={width} height={height} fill="none" aria-hidden="true">
      <g opacity={confetti ? 0.42 : 1}>
        {bursts.map(({ x, y, size, color, rays }) => (
          <g key={x} transform={`translate(${x} ${y}) scale(${size})`}>
            <circle r="38" stroke={color} strokeOpacity=".24" strokeDasharray="2 6" />
            <circle r="67" stroke={color} strokeOpacity=".17" />
            <path d="M-7 0H7M0-7V7" stroke={color} strokeWidth="2" />
            {Array.from({ length: rays }, (_, ray) => (
              <g key={ray} transform={`rotate(${(ray * 360) / rays + variant * 5})`}>
                <path d="M0-17V-32" stroke={color} strokeWidth="2" strokeOpacity=".52" />
                <path d="M0-47V-56" stroke={color} strokeWidth="3" />
                <rect x="-3" y={ray % 2 ? -78 : -91} width="6" height="6" rx="1" fill={color} />
              </g>
            ))}
          </g>
        ))}
        <path d="M64 63h12m-6-6v12m217-33h12m-6-6v12M49 169h8m-4-4v8m108 25h8m-4-4v8" stroke="#d6ff3f" />
        <path d="M85 102h4m44-63h4m174 43h4M222 195h4" stroke="#b596f2" strokeWidth="4" />
      </g>
      {confetti > 0 && (
        <g className="year-review-confetti">
          {bursts.slice(0, Math.ceil(confetti / 8)).map(({ x, y }, burst) => (
            <g key={x} transform={`translate(${x} ${y})`}>
              {Array.from({ length: Math.min(8, confetti - burst * 8) }, (_, index) => {
                const angle = ((index * 45 + variant * 13 + burst * 25) * Math.PI) / 180;
                const distance = 54 + ((index * 17 + variant * 9) % 34);
                return (
                  <rect
                    key={index}
                    x="-2"
                    y="-2"
                    width={4 + (index % 3)}
                    height={index % 3 === 0 ? 8 : 4}
                    rx="1"
                    fill={confettiColors[index % confettiColors.length]}
                    style={
                      {
                        "--confetti-x": `${Math.round(Math.cos(angle) * distance)}px`,
                        "--confetti-y": `${Math.round(Math.sin(angle) * distance)}px`,
                        "--confetti-turn": `${index % 2 ? -105 : 125}deg`,
                        animationDelay: `-${(variant * 2.1 + burst * 5.5) % 13}s`,
                      } as CSSProperties
                    }
                  />
                );
              })}
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
