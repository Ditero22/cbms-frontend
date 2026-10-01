import { ArrowUpRight } from 'lucide-react'
import type { DashboardTask } from '../dashboard.utils'

type PriorityTasksPanelProps = {
  tasks: DashboardTask[]
  isLoading: boolean
  onOpenTask: (path: string) => void
}

export function PriorityTasksPanel({ tasks, isLoading, onOpenTask }: PriorityTasksPanelProps) {
  return (
    <article className="panel tasks-panel">
      <div className="panel-heading">
        <div>
          <div className="panel-kicker">NEEDS ATTENTION</div>
          <h2>Priority tasks</h2>
          <p>Based on inventory and expense records</p>
        </div>
        <span className="task-count">{tasks.length}</span>
      </div>
      <div className="task-list">
        {tasks.map((task, index) => (
          <TaskItem
            key={`${task.title}-${index}`}
            {...task}
            onClick={() => onOpenTask(task.path)}
          />
        ))}
        {tasks.length === 0 && (
          <div className="table-empty">
            <strong>{isLoading ? 'Checking for tasks…' : 'No priority items found.'}</strong>
          </div>
        )}
      </div>
    </article>
  )
}

function TaskItem({
  icon: Icon,
  tone,
  title,
  text,
  meta,
  onClick,
}: DashboardTask & { onClick: () => void }) {
  return (
    <button className="task-item" onClick={onClick}>
      <span className={`task-icon ${tone}`}>
        <Icon size={17} />
      </span>
      <span className="task-copy">
        <strong>{title}</strong>
        <span>{text}</span>
        <small>{meta}</small>
      </span>
      <ArrowUpRight size={15} className="task-arrow" />
    </button>
  )
}
