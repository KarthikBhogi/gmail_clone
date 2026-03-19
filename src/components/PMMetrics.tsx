import React from 'react';
import { BarChart, TrendingUp, Clock, Target, CheckCircle2, Activity, Users, ShieldCheck, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

interface MetricCardProps {
  title: string;
  value: string;
  trend: string;
  trendUp: boolean;
  description: string;
  icon: React.ElementType;
  progress?: number;
  highlightCategory?: 'blue' | 'emerald' | 'amber' | 'purple' | 'indigo';
}

function MetricCard({ title, value, trend, trendUp, description, icon: Icon, progress, highlightCategory = 'blue' }: MetricCardProps) {
  const styles = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-100', bar: 'bg-blue-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100', bar: 'bg-emerald-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100', bar: 'bg-amber-500' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', ring: 'ring-purple-100', bar: 'bg-purple-500' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', ring: 'ring-indigo-100', bar: 'bg-indigo-500' },
  }[highlightCategory];

  return (
    <div className="group relative rounded-2xl border border-gray-100 bg-white p-6 shadow-sm ring-1 ring-inset ring-transparent transition-all hover:bg-gray-50/50 hover:shadow-md hover:ring-gray-200 overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: `var(--tw-${styles.bar.replace('bg-', '')})` }} />
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl ring-1", styles.bg, styles.text, styles.ring)}>
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="text-[14px] font-medium text-gray-700">{title}</h3>
        </div>
        <div className={cn("flex items-center gap-1 text-[13px] font-semibold", trendUp ? "text-emerald-600" : "text-amber-600")}>
          {trendUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5 rotate-180" />}
          {trend}
        </div>
      </div>
      
      <div className="mt-5">
        <div className="text-3xl font-bold tracking-tight text-gray-900">{value}</div>
        <p className="mt-2 text-sm text-gray-500">{description}</p>
      </div>

      {progress !== undefined && (
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 mb-2">
            <span>Target completion</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div 
              className={cn("h-full rounded-full transition-all duration-1000 ease-out", styles.bar)} 
              style={{ width: `${progress}%` }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function PMMetrics() {
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 h-full p-8 md:p-12">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Weekly Review Metrics</h1>
            <p className="mt-2 text-[15px] text-gray-600 max-w-2xl">
              Performance indicators tracking the adoption, trust, and business impact of the Workspace contextual summaries.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm text-sm font-medium text-gray-700">
            <Target className="h-4 w-4 text-blue-600" />
            North Star: Completion Rate (68%)
          </div>
        </div>

        {/* Level 1: Habit & Closure (Weekly) */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">1. Habit & Closure <span className="text-sm font-normal text-gray-500 ml-2">(Weekly cadence)</span></h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 data-charts">
            <MetricCard
              title="Completion Rate"
              value="68.4%"
              trend="+4.2%"
              trendUp={true}
              description="Users who finish their weekly review after starting."
              icon={CheckCircle2}
              progress={68.4}
              highlightCategory="emerald"
            />
            <MetricCard
              title="Start Rate"
              value="42.1%"
              trend="+1.8%"
              trendUp={true}
              description="Users who initiate review when prompted."
              icon={Activity}
              progress={42.1}
              highlightCategory="blue"
            />
            <MetricCard
              title="Confidence Score"
              value="4.5 / 5"
              trend="+0.3"
              trendUp={true}
              description="Self-reported inbox clarity post-review."
              icon={Target}
              highlightCategory="amber"
            />
            <MetricCard
              title="Time to Closure"
              value="4.2 mins"
              trend="-1.4m"
              trendUp={true}
              description="Average time spent completing weekly review."
              icon={Clock}
              highlightCategory="indigo"
            />
          </div>
        </div>

        {/* Level 2: Trust & Quality (Sprint) */}
        <div>
          <div className="flex items-center gap-2 mb-4 mt-8">
            <h2 className="text-lg font-semibold text-gray-900">2. Trust & Quality <span className="text-sm font-normal text-gray-500 ml-2">(Sprint cadence)</span></h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
              title="AI Acceptance Rate"
              value="89.2%"
              trend="+2.1%"
              trendUp={true}
              description="Action item suggestions accepted without edits."
              icon={ShieldCheck}
              progress={89.2}
              highlightCategory="purple"
            />
            <MetricCard
              title="Drop-off Stage"
              value="Prioritization"
              trend="Highest Exit"
              trendUp={false}
              description="Stage where users most frequently abandon review."
              icon={TrendingUp}
              highlightCategory="amber"
            />
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-medium text-gray-700 mb-5">Drop-off Breakdown</h3>
              <div className="space-y-4">
                {[
                  { label: "Trigger (Ignored)", val: "57%", width: "57%" },
                  { label: "Digest Review", val: "12%", width: "12%" },
                  { label: "Prioritization", val: "22%", width: "22%" },
                  { label: "Action/Resolve", val: "9%", width: "9%" },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 w-32">{item.label}</span>
                    <div className="flex-1 mx-4 h-2 rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-slate-400" style={{ width: item.width }} />
                    </div>
                    <span className="text-gray-900 font-medium w-8 text-right">{item.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Level 3: Business Impact (Monthly) */}
        <div>
          <div className="flex items-center gap-2 mb-4 mt-8">
            <h2 className="text-lg font-semibold text-gray-900">3. Business Impact <span className="text-sm font-normal text-gray-500 ml-2">(Quarterly cadence)</span></h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
              title="Gemini Lift"
              value="+14.2%"
              trend="+3.1%"
              trendUp={true}
              description="Increase in overall Gemini feature adoption."
              icon={Zap}
              progress={14.2}
              highlightCategory="blue"
            />
            <MetricCard
              title="Cohort Retention"
              value="82.5%"
              trend="+5.4%"
              trendUp={true}
              description="Retention of users engaging in weekly review."
              icon={Users}
              progress={82.5}
              highlightCategory="emerald"
            />
            <MetricCard
              title="Segment Penetration"
              value="3.2M"
              trend="+120K"
              trendUp={true}
              description="Active power-users utilizing review."
              icon={BarChart}
              highlightCategory="indigo"
            />
          </div>
        </div>

        <div className="h-12" /> {/* Bottom padding */}
      </div>
    </div>
  );
}
