import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = false,
  isLoading = false,
}) => {
  const [internalSubmitting, setInternalSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setInternalSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isBusy = isLoading || internalSubmitting;

  const handleConfirm = async () => {
    if (isBusy) return;
    try {
      setInternalSubmitting(true);
      await Promise.resolve(onConfirm());
    } finally {
      setInternalSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-start gap-3">
          <div className={`mt-0.5 p-2 rounded-full shrink-0 ${isDestructive ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{message}</p>
          </div>
        </div>
        
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isBusy}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${
              isDestructive 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isBusy && (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
