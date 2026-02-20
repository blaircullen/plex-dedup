import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Copy, ArrowUpCircle, Trash2, Settings, Music } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/duplicates', label: 'Duplicates', icon: Copy },
  { to: '/upgrades', label: 'Upgrades', icon: ArrowUpCircle },
  { to: '/trash', label: 'Trash', icon: Trash2 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const [expanded, setExpanded] = useState(false)

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={`fixed left-0 top-0 h-screen bg-base-800/80 backdrop-blur-xl border-r border-glass-border z-40 flex flex-col transition-all duration-300 ${expanded ? 'w-60' : 'w-[72px]'}`}
    >
      <div className="flex items-center gap-3 px-5 h-16 border-b border-glass-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-lime flex items-center justify-center shrink-0">
          <Music className="w-4 h-4 text-base-900" />
        </div>
        <span className={`font-[family-name:var(--font-family-display)] font-bold text-lg whitespace-nowrap transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0'}`}>
          ShoopDeDupe
        </span>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative group ${
                isActive
                  ? 'text-lime bg-lime-dim'
                  : 'text-base-400 hover:text-white hover:bg-base-700/50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-lime rounded-r-full -ml-3" />
                )}
                <Icon className="w-5 h-5 shrink-0" />
                <span className={`whitespace-nowrap transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0'}`}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={`px-5 py-4 border-t border-glass-border text-xs text-base-500 transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0'}`}>
        ShoopDeDupe v1.0
      </div>
    </aside>
  )
}
