import toast, { Toaster as HotToaster } from 'react-hot-toast'

export { toast }

export function Toaster() {
  return (
    <HotToaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'rgba(17, 22, 39, 0.9)',
          backdropFilter: 'blur(12px)',
          color: '#e2e8f0',
          border: '1px solid rgba(90, 101, 133, 0.3)',
          borderRadius: '12px',
          fontSize: '14px',
          fontFamily: 'Outfit, sans-serif',
        },
        success: {
          iconTheme: { primary: '#CCFF00', secondary: '#0a0e1a' },
        },
        error: {
          iconTheme: { primary: '#ef4444', secondary: '#0a0e1a' },
        },
        duration: 3000,
      }}
    />
  )
}
