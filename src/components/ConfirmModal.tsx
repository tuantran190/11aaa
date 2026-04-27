import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  type = 'warning'
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-[480px] overflow-hidden z-10"
          >
            <div className="p-8 sm:p-10 text-center">
              <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
                type === 'danger' ? 'bg-red-50 text-red-500' : 
                type === 'warning' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'
              }`}>
                <AlertTriangle size={40} strokeWidth={1.5} />
              </div>
              
              <h3 className="text-2xl font-serif text-black mb-4">{title}</h3>
              <p className="text-stone-500 leading-relaxed mb-10">
                {message}
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={onClose}
                  className="py-4 rounded-2xl border border-stone-200 text-stone-600 font-bold uppercase tracking-widest text-[10px] hover:bg-stone-50 transition-all active:scale-95"
                >
                  {cancelText}
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={`py-4 rounded-2xl text-white font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-lg ${
                    type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-200' : 
                    'bg-black hover:bg-stone-800 shadow-stone-200'
                  }`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 text-stone-400 hover:text-black transition-colors"
            >
              <X size={20} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmModal;
