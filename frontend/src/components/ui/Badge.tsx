type BadgeVariant = 'default' | 'lime' | 'blue' | 'amber' | 'red' | 'emerald'

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-base-700 text-base-300 border-base-600',
  lime: 'bg-lime-dim text-lime border-lime/20',
  blue: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  red: 'bg-red-500/15 text-red-400 border-red-500/20',
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variantClasses[variant]}`}>
      {children}
    </span>
  )
}
