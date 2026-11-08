const bursts = [
  { x: 205, y: 94, size: 1, color: "#b596f2" },
  { x: 106, y: 148, size: 0.57, color: "#855dcd" },
  { x: 280, y: 147, size: 0.47, color: "#d6ff3f" },
];

export function YearReviewFireworks({ width, height }: { width?: number; height?: number }) {
  return (
    <svg viewBox="0 0 340 220" width={width} height={height} fill="none" aria-hidden="true">
      {bursts.map(({ x, y, size, color }) => (
        <g key={x} transform={`translate(${x} ${y}) scale(${size})`}>
          <circle r="38" stroke={color} strokeOpacity=".24" strokeDasharray="2 6" />
          <circle r="67" stroke={color} strokeOpacity=".17" />
          <path d="M-7 0H7M0-7V7" stroke={color} strokeWidth="2" />
          {Array.from({ length: 12 }, (_, ray) => (
            <g key={ray} transform={`rotate(${ray * 30})`}>
              <path d="M0-17V-32" stroke={color} strokeWidth="2" strokeOpacity=".52" />
              <path d="M0-47V-56" stroke={color} strokeWidth="3" />
              <rect x="-3" y={ray % 2 ? -78 : -91} width="6" height="6" rx="1" fill={color} />
            </g>
          ))}
        </g>
      ))}
      <path d="M64 63h12m-6-6v12m217-33h12m-6-6v12M49 169h8m-4-4v8m108 25h8m-4-4v8" stroke="#d6ff3f" />
      <path d="M85 102h4m44-63h4m174 43h4M222 195h4" stroke="#b596f2" strokeWidth="4" />
    </svg>
  );
}
