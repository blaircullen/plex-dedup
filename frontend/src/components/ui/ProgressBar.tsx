import { motion } from 'motion/react'

interface ProgressBarProps {
  value: number
  max: number
  label?: string
  detail?: string
}

export function ProgressBar({ value, max, label, detail }: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0

  return (
    <div className="space-y-2">
      {(label || detail) && (
        <div className="flex items-center justify-between text-sm">
          {label && <span className="text-base-300">{label}</span>}
          {detail && <span className="text-base-400 font-mono text-xs">{detail}</span>}
        </div>
      )}
      <div className="w-full h-2 bg-base-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-lime rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
