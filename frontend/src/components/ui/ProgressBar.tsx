import { motion } from 'motion/react'

interface ProgressBarProps {
  value?: number
  max?: number
  label?: string
  detail?: string
}

export function ProgressBar({ value, max, label, detail }: ProgressBarProps) {
  const isIndeterminate = value === undefined || max === undefined || max === 0
  const pct = !isIndeterminate ? Math.min((value / max) * 100, 100) : 0

  return (
    <div className="space-y-2">
      {(label || detail) && (
        <div className="flex items-center justify-between text-sm">
          {label && <span className="text-base-300">{label}</span>}
          {detail && <span className="text-base-400 font-mono text-xs">{detail}</span>}
        </div>
      )}
      <div className="w-full h-2 bg-base-800 rounded-full overflow-hidden">
        {isIndeterminate ? (
          <motion.div
            className="h-full w-1/3 bg-lime rounded-full"
            animate={{ x: ['-100%', '400%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : (
          <motion.div
            className="h-full bg-lime rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        )}
      </div>
    </div>
  )
}
