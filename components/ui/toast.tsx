import toast, { Toaster } from 'react-hot-toast';

// Toast notification system with consistent styling
export const showToast = {
  success: (message: string) => 
    toast.success(message, {
      duration: 3000,
      style: {
        background: '#10b981',
        color: '#ffffff',
        fontWeight: '500',
        borderRadius: '8px',
        padding: '12px 16px',
      },
    }),
  
  error: (message: string) => 
    toast.error(message, {
      duration: 4000,
      style: {
        background: '#ef4444',
        color: '#ffffff',
        fontWeight: '500',
        borderRadius: '8px',
        padding: '12px 16px',
      },
    }),
  
  loading: (message: string) => 
    toast.loading(message, {
      style: {
        background: '#3b82f6',
        color: '#ffffff',
        fontWeight: '500',
        borderRadius: '8px',
        padding: '12px 16px',
      },
    }),
  
  info: (message: string) => 
    toast(message, {
      duration: 3000,
      style: {
        background: '#6b7280',
        color: '#ffffff',
        fontWeight: '500',
        borderRadius: '8px',
        padding: '12px 16px',
      },
    }),
};

// Toast container component
export function ToastContainer() {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      gutter={8}
      containerStyle={{
        top: 80, // Account for header height
      }}
      toastOptions={{
        duration: 3000,
        style: {
          maxWidth: '500px',
          fontSize: '14px',
        },
      }}
    />
  );
}