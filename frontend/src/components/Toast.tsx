import { useToast } from '../hooks/useToast';
import { CheckCircle2, AlertCircle, Sparkles, X } from 'lucide-react';

const iconMap = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Sparkles,
};

const bgMap = {
  success: 'bg-white border border-emerald-200',
  error: 'bg-white border border-red-200',
  info: 'bg-white border border-blue-200',
};

const iconColor = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  info: 'text-blue-500',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[99999] flex flex-col gap-3 w-[90vw] max-w-sm">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 px-5 py-4 rounded-xl shadow-xl ${bgMap[toast.type]}`}
            style={{ animation: 'toastIn 0.4s cubic-bezier(0.16,1,0.3,1)' }}
          >
            <Icon className={`w-6 h-6 shrink-0 mt-0.5 ${iconColor[toast.type]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-gray-900 leading-tight">{toast.message}</p>
              {toast.subtitle && (
                <p className="text-[13px] text-gray-500 mt-1">{toast.subtitle}</p>
              )}
            </div>
            <button onClick={() => removeToast(toast.id)} className="shrink-0 text-gray-400 hover:text-gray-600 mt-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes toastIn {
          0% { opacity: 0; transform: translateY(-20px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
