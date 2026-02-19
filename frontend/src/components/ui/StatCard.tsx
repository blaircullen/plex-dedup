import type { LucideIcon } from 'lucide-react'
import { GlassCard } from './GlassCard'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
}

export function StatCard({ icon: Icon, label, value }: StatCardProps) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-base-400 mb-1">{label}</p>
          <p className="text-2xl font-bold font-[family-name:var(--font-family-display)]">{value}</p>
        </div>
        <div className="p-2 rounded-xl bg-lime-dim">
          <Icon className="w-5 h-5 text-lime" />
        </div>
      </div>
    </GlassCard>
  )
}
