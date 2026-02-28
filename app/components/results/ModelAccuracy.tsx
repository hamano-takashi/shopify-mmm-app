import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ModelAccuracyProps {
  r_squared: number;
  mape: number;
  actual_vs_predicted: {
    dates?: string[];
    actual?: number[];
    predicted?: number[];
  };
}

function getAccuracyGrade(r2: number): { label: string; color: string } {
  if (r2 >= 90) return { label: "非常に良い", color: "#108043" };
  if (r2 >= 80) return { label: "良い", color: "#00A0AC" };
  if (r2 >= 70) return { label: "普通", color: "#EEC200" };
  return { label: "要改善", color: "#DE3618" };
}

export function ModelAccuracy({
  r_squared,
  mape,
  actual_vs_predicted,
}: ModelAccuracyProps) {
  const grade = getAccuracyGrade(r_squared);

  const hasTimeSeries =
    actual_vs_predicted?.dates?.length &&
    actual_vs_predicted?.actual?.length &&
    actual_vs_predicted?.predicted?.length;

  const chartData = hasTimeSeries
    ? actual_vs_predicted.dates!.map((date, i) => ({
        date,
        actual: actual_vs_predicted.actual![i],
        predicted: actual_vs_predicted.predicted![i],
      }))
    : [];

  const formatYen = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return value.toString();
  };

  return (
    <div>
      {/* KPI cards */}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "24px" }}>
        <div
          style={{
            flex: "1 1 200px",
            padding: "20px",
            border: "1px solid #e1e3e5",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "14px", color: "#637381", marginBottom: "8px" }}>
            決定係数 (R²)
          </div>
          <div style={{ fontSize: "36px", fontWeight: 700, color: grade.color }}>
            {r_squared}%
          </div>
          <div style={{ fontSize: "13px", color: grade.color, fontWeight: 600 }}>
            {grade.label}
          </div>
        </div>

        <div
          style={{
            flex: "1 1 200px",
            padding: "20px",
            border: "1px solid #e1e3e5",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "14px", color: "#637381", marginBottom: "8px" }}>
            平均絶対誤差率 (MAPE)
          </div>
          <div style={{ fontSize: "36px", fontWeight: 700, color: mape <= 10 ? "#108043" : "#DE3618" }}>
            {mape}%
          </div>
          <div style={{ fontSize: "13px", color: "#637381" }}>
            {mape <= 10 ? "高精度" : mape <= 20 ? "許容範囲" : "要改善"}
          </div>
        </div>
      </div>

      {/* Actual vs Predicted chart */}
      {chartData.length > 0 && (
        <div>
          <div style={{ marginBottom: "8px" }}>
            <s-text variant="headingSm">実測値 vs 予測値</s-text>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(d: string) => d.slice(5)} // MM-DD
              />
              <YAxis tickFormatter={formatYen} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `¥${value.toLocaleString()}`,
                  name === "actual" ? "実測値" : "予測値",
                ]}
              />
              <Legend
                formatter={(value: string) =>
                  value === "actual" ? "実測値" : "予測値"
                }
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#5C6AC4"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#DE3618"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Explanation */}
      <div style={{ marginTop: "16px", padding: "12px", backgroundColor: "#f4f6f8", borderRadius: "8px" }}>
        <s-text variant="bodySm" tone="subdued">
          R²（決定係数）はモデルが売上変動をどれだけ説明できるかを示します。
          80%以上であれば実用レベルです。MAPEは予測と実際の平均的なズレの割合です。
        </s-text>
      </div>
    </div>
  );
}
