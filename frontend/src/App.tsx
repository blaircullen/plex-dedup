import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Sidebar } from './components/layout/Sidebar'
import { ActivityPanel } from './components/layout/ActivityPanel'
import { Toaster } from './components/ui'
import Dashboard from './pages/Dashboard'
import Duplicates from './pages/Duplicates'
import Upgrades from './pages/Upgrades'
import Trash from './pages/Trash'
import Settings from './pages/Settings'

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
      >
        <Routes location={location}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/duplicates" element={<Duplicates />} />
          <Route path="/upgrades" element={<Upgrades />} />
          <Route path="/trash" element={<Trash />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <Sidebar />
        <main className="ml-[72px] p-8">
          <div className="mb-6 flex justify-end">
            <ActivityPanel />
          </div>
          <AnimatedRoutes />
        </main>
        <Toaster />
      </div>
    </BrowserRouter>
  )
}
