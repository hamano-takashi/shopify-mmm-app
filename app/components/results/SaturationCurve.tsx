import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useState } from "react";

interface SaturationData {
  name: string;
  spend: number[];
  response: number[];
  current_spend: number;
}

interface SaturationCurveProps {
  saturation: Record<string, SaturationData>;
}

const COLORS = [
  "#5C6AC4",
  "#007ACE",
  "#00A0AC",
  "#108043",
  "#EEC200",
  "#DE3618",
];

export function SaturationCurve({ saturation }: SaturationCurveProps) {
  const channels = Object.keys(saturation);
  const [selectedChannel, setSelectedChannel] = useState(channels[0] || "");

  if (channels.length === 0) {
    return (
      <s-text variant="bodyMd" tone="subdued">
        飽和曲線データがありません
      </s-text>
    );
  }

  const channelData = saturation[selectedChannel];
  if (!channelData) return null;

  const chartData = channelData.spend.map((s, i) => ({
    spend: Math.round(s),
    response: Math.round(channelData.response[i] || 0),
  }));

  const formatYen = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return value.toString();
  };

  return (
    <div>
      {/* Channel selector */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
        {channels.map((ch, i) => (
          <button
            key={ch}
            onClick={() => setSelectedChannel(ch)}
            style={{
              padding: "6px 12px",
              border: selectedChannel === ch ? "2px solid" : "1px solid #c4cdd5",
              borderColor: selectedChannel === ch ? COLORS[i % COLORS.length] : "#c4cdd5",
              borderRadius: "4px",
              backgroundColor: selectedChannel === ch ? `${COLORS[i % COLORS.length]}15` : "white",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            {saturation[ch].name}
          </button>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ left: 20, right: 30, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="spend"
            tickFormatter={formatYen}
            label={{ value: "投資額 (円)", position: "bottom", offset: 0 }}
          />
          <YAxis
            tickFormatter={formatYen}
            label={{ value: "効果 (円)", angle: -90, position: "insideLeft", offset: -10 }}
          />
          <Tooltip
            formatter={(value: number) => [`¥${value.toLocaleString()}`, "効果"]}
            labelFormatter={(label: number) => `投資: ¥${label.toLocaleString()}`}
          />
          {channelData.current_spend > 0 && (
            <ReferenceLine
              x={Math.round(channelData.current_spend)}
              stroke="#DE3618"
              strokeDasharray="5 5"
              label={{ value: "現在", position: "top", fill: "#DE3618" }}
            />
          )}
          <Line
            type="monotone"
            dataKey="response"
            stroke={COLORS[channels.indexOf(selectedChannel) % COLORS.length]}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div style={{ marginTop: "8px", textAlign: "center" }}>
        <s-text variant="bodySm" tone="subdued">
          投資額が増えるほど効果の伸びが鈍化（飽和）する様子を示します。
          赤い点線は現在の投資水準です。
        </s-text>
      </div>
    </div>
  );
}
