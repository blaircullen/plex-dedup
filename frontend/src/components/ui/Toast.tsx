import toast, { Toaster as HotToaster } from 'react-hot-toast'

export { toast }

export function Toaster() {
  return (
    <HotToaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#FFFFFF',
          color: '#1E293B',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          fontSize: '14px',
          fontFamily: 'Outfit, sans-serif',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        },
        success: {
          iconTheme: { primary: '#10B981', secondary: '#FFFFFF' },
        },
        error: {
          iconTheme: { primary: '#ef4444', secondary: '#FFFFFF' },
        },
        duration: 3000,
      }}
    />
  )
}
