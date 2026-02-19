import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-2xl bg-base-800/50 mb-4">
        <Icon className="w-10 h-10 text-base-500" />
      </div>
      <h3 className="text-lg font-semibold font-[family-name:var(--font-family-display)] mb-2">{title}</h3>
      <p className="text-base-400 text-sm max-w-sm mb-4">{description}</p>
      {action}
    </div>
  )
}
