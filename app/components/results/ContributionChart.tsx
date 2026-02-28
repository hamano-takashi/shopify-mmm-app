import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

interface ChannelData {
  id: string;
  name: string;
  contribution: number;
  roas: number;
}

interface ContributionChartProps {
  channels: ChannelData[];
}

const COLORS = [
  "#5C6AC4", // Shopify purple
  "#007ACE", // Blue
  "#00A0AC", // Teal
  "#108043", // Green
  "#EEC200", // Yellow
  "#DE3618", // Red
  "#9C6ADE", // Light purple
  "#47C1BF", // Cyan
];

export function ContributionChart({ channels }: ContributionChartProps) {
  if (!channels || channels.length === 0) {
    return (
      <s-text variant="bodyMd" tone="subdued">
        貢献度データがありません
      </s-text>
    );
  }

  const barData = channels
    .sort((a, b) => b.contribution - a.contribution)
    .map((ch) => ({
      name: ch.name,
      contribution: ch.contribution,
      roas: ch.roas,
    }));

  const pieData = channels.map((ch) => ({
    name: ch.name,
    value: ch.contribution,
  }));

  return (
    <div>
      {/* Bar Chart */}
      <div style={{ marginBottom: "24px" }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData} layout="vertical" margin={{ left: 80, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" unit="%" domain={[0, "auto"]} />
            <YAxis type="category" dataKey="name" width={80} />
            <Tooltip
              formatter={(value: number) => [`${value}%`, "貢献度"]}
            />
            <Bar dataKey="contribution" radius={[0, 4, 4, 0]}>
              {barData.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie Chart */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={({ name, value }) => `${name}: ${value}%`}
            >
              {pieData.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => [`${value}%`, "貢献度"]} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* ROAS Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e1e3e5" }}>
            <th style={{ textAlign: "left", padding: "8px" }}>チャネル</th>
            <th style={{ textAlign: "right", padding: "8px" }}>貢献度</th>
            <th style={{ textAlign: "right", padding: "8px" }}>ROAS</th>
          </tr>
        </thead>
        <tbody>
          {barData.map((ch, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #e1e3e5" }}>
              <td style={{ padding: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: "12px",
                    height: "12px",
                    borderRadius: "2px",
                    backgroundColor: COLORS[i % COLORS.length],
                  }}
                />
                {ch.name}
              </td>
              <td style={{ textAlign: "right", padding: "8px" }}>{ch.contribution}%</td>
              <td style={{ textAlign: "right", padding: "8px" }}>{ch.roas.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
