"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { NPS_COLORS, type NpsGroup, type Summary } from "@/lib/survey-analytics";

interface Props {
  summary: Summary;
  distribution: { score: number; count: number; group: NpsGroup }[];
}

const GROUPS = [
  { key: "promoter", label: "مروّجون (9-10)", countKey: "promoters", pctKey: "promoterPct" },
  { key: "passive", label: "محايدون (7-8)", countKey: "passives", pctKey: "passivePct" },
  { key: "detractor", label: "منتقدون (0-6)", countKey: "detractors", pctKey: "detractorPct" },
] as const;

export function NpsCharts({ summary, distribution }: Props) {
  const pieData = GROUPS.map((g) => ({ name: g.label, value: summary[g.countKey], color: NPS_COLORS[g.key] }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">تصنيف العملاء (NPS)</h2>
        <p className="text-sm text-slate-600">من أجاب على سؤال NPS: {summary.npsCount} عميل.</p>

        <div className="mt-4 grid items-center gap-4 sm:grid-cols-2">
          {/* Charts stay left-to-right so Recharts does not mirror its geometry in an RTL page. */}
          <div dir="ltr" className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                  {pieData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value} عميل`, "العدد"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #E5E9EE", fontSize: 13 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="space-y-3">
            {GROUPS.map((g) => (
              <li key={g.key} className="flex items-center gap-3">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: NPS_COLORS[g.key] }} />
                <span className="flex-1 text-sm">{g.label}</span>
                <span className="text-sm font-semibold tabular-nums">{summary[g.pctKey].toFixed(1)}%</span>
                <span className="w-10 text-end text-xs tabular-nums text-slate-500">{summary[g.countKey]}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">عدد التقييمات حسب الدرجة</h2>
        <p className="text-sm text-slate-600">كل عمود يمثل درجة من 0 إلى 10، ولونه حسب التصنيف.</p>

        <div dir="ltr" className="mt-4 h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distribution} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="#E5E9EE" vertical={false} />
              <XAxis dataKey="score" interval={0} tickLine={false} axisLine={false} fontSize={12} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip
                cursor={{ fill: "#F3F5F8" }}
                labelFormatter={(score) => `التقييم ${score}`}
                formatter={(value) => [`${value} عميل`, "العدد"]}
                contentStyle={{ borderRadius: 8, border: "1px solid #E5E9EE", fontSize: 13 }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {distribution.map((d) => (
                  <Cell key={d.score} fill={NPS_COLORS[d.group]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
