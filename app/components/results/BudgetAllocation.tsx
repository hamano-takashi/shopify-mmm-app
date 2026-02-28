import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface AllocationItem {
  channel: string;
  allocation: number;
}

interface BudgetAllocationProps {
  current: AllocationItem[];
  optimal: AllocationItem[];
}

export function BudgetAllocation({ current, optimal }: BudgetAllocationProps) {
  if (!current?.length || !optimal?.length) {
    return (
      <s-text variant="bodyMd" tone="subdued">
        予算配分データがありません
      </s-text>
    );
  }

  // Merge current & optimal by channel name
  const channelSet = new Set([
    ...current.map((c) => c.channel),
    ...optimal.map((o) => o.channel),
  ]);

  const data = Array.from(channelSet).map((ch) => ({
    channel: ch,
    current: current.find((c) => c.channel === ch)?.allocation || 0,
    optimal: optimal.find((o) => o.channel === ch)?.allocation || 0,
  }));

  // Sort by optimal allocation descending
  data.sort((a, b) => b.optimal - a.optimal);

  return (
    <div>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={data} margin={{ left: 80, right: 30 }} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" unit="%" domain={[0, "auto"]} />
          <YAxis type="category" dataKey="channel" width={80} />
          <Tooltip formatter={(value: number) => [`${value}%`]} />
          <Legend />
          <Bar dataKey="current" name="現在の配分" fill="#919EAB" radius={[0, 4, 4, 0]} />
          <Bar dataKey="optimal" name="最適配分" fill="#5C6AC4" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Diff table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e1e3e5" }}>
            <th style={{ textAlign: "left", padding: "8px" }}>チャネル</th>
            <th style={{ textAlign: "right", padding: "8px" }}>現在</th>
            <th style={{ textAlign: "right", padding: "8px" }}>最適</th>
            <th style={{ textAlign: "right", padding: "8px" }}>差分</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const diff = row.optimal - row.current;
            return (
              <tr key={row.channel} style={{ borderBottom: "1px solid #e1e3e5" }}>
                <td style={{ padding: "8px" }}>{row.channel}</td>
                <td style={{ textAlign: "right", padding: "8px" }}>{row.current}%</td>
                <td style={{ textAlign: "right", padding: "8px" }}>{row.optimal}%</td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "8px",
                    color: diff > 0 ? "#108043" : diff < 0 ? "#DE3618" : "#637381",
                    fontWeight: 600,
                  }}
                >
                  {diff > 0 ? "+" : ""}
                  {diff.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
