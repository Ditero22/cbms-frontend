import type { DashboardStat } from '../dashboard.utils'

type StatsGridProps = { stats: DashboardStat[]; isLoading: boolean }

export function StatsGrid({ stats, isLoading }: StatsGridProps) {
  return (
    <section className="stat-grid">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <article className="stat-card" key={stat.title}>
            <div className="stat-top">
              <span>{stat.title}</span>
              <span className={`stat-icon ${stat.tone}`}>
                <Icon size={18} />
              </span>
            </div>
            <strong className="stat-value">{isLoading ? '—' : stat.value}</strong>
            <div className="stat-bottom">
              <span>{isLoading ? 'Loading current data…' : stat.note}</span>
            </div>
          </article>
        )
      })}
    </section>
  )
}
