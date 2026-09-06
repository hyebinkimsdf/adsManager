/** @jsxImportSource @emotion/react */
"use client";

interface LineChartProps {
  data: number[];
  labels?: string[];
  color?: string;
  height?: number;
  showAxis?: boolean;
}

export function LineChart({
  data,
  labels,
  color = "var(--color-blue-500)",
  height = 64,
  showAxis = false,
}: LineChartProps) {
  if (data.length === 0) return null;
  const width = 320;
  const padding = showAxis ? 8 : 2;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return { x, y, v };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${height} L${points[0].x.toFixed(1)},${height} Z`;

  return (
    <div css={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        css={{ width: "100%" }}
        preserveAspectRatio="none"
        role="img"
        aria-label="성과 추이 그래프"
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#chart-fill)" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) =>
          i === points.length - 1 ? <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} /> : null
        )}
      </svg>
      {showAxis && labels && (
        <div css={{ marginTop: "0.25rem", display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--color-gray-400)" }}>
          <span>{labels[0]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
}
