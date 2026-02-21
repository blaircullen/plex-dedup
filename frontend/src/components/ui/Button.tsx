import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Loader2, Check } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonState = 'idle' | 'loading' | 'success'

interface ButtonProps {
  children: React.ReactNode
  variant?: ButtonVariant
  onClick?: () => void | Promise<void>
  disabled?: boolean
  className?: string
  size?: 'sm' | 'md'
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-lime text-white hover:bg-lime/90 font-semibold',
  secondary: 'bg-base-700 text-base-300 hover:bg-base-600 border border-glass-border',
  danger: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30',
  ghost: 'text-base-400 hover:text-base-300 hover:bg-base-700/50',
}

export function Button({ children, variant = 'primary', onClick, disabled, className = '', size = 'md' }: ButtonProps) {
  const [state, setState] = useState<ButtonState>('idle')

  const handleClick = useCallback(async () => {
    if (!onClick || state === 'loading') return
    setState('loading')
    try {
      await onClick()
      setState('success')
    } catch {
      setState('idle')
    }
  }, [onClick, state])

  useEffect(() => {
    if (state === 'success') {
      const t = setTimeout(() => setState('idle'), 1200)
      return () => clearTimeout(t)
    }
  }, [state])

  const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={handleClick}
      disabled={disabled || state === 'loading'}
      className={`${sizeClass} rounded-xl font-medium transition-all duration-200 inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
    >
      <AnimatePresence mode="wait">
        {state === 'loading' ? (
          <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Loader2 className="w-4 h-4 animate-spin" />
          </motion.span>
        ) : state === 'success' ? (
          <motion.span key="success" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ opacity: 0 }}>
            <Check className="w-4 h-4" />
          </motion.span>
        ) : null}
      </AnimatePresence>
      {state === 'loading' ? 'Working...' : state === 'success' ? 'Done' : children}
    </motion.button>
  )
}
