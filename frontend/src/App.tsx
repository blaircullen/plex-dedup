import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Duplicates from './pages/Duplicates'
import Upgrades from './pages/Upgrades'
import Trash from './pages/Trash'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <nav className="border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-bold tracking-tight">plex-dedup</h1>
            <div className="flex gap-4">
              {[
                ['/', 'Dashboard'],
                ['/duplicates', 'Duplicates'],
                ['/upgrades', 'Upgrades'],
                ['/trash', 'Trash'],
                ['/settings', 'Settings'],
              ].map(([to, label]) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>
        <main className="p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/duplicates" element={<Duplicates />} />
            <Route path="/upgrades" element={<Upgrades />} />
            <Route path="/trash" element={<Trash />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
