'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ isOpen, onClose, title, children, maxWidth = '400px' }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative bg-[#1e1e1e] border border-[#3e3e3e] rounded-xl shadow-2xl overflow-hidden w-full flex flex-col"
            style={{ maxWidth }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d2d2d]">
              <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
              <button onClick={onClose} className="p-1 hover:bg-[#37373d] rounded text-gray-400 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[80vh]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  isDestructive?: boolean;
}

export function ConfirmDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmLabel = 'Confirm',
  isDestructive = true
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          {isDestructive && <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />}
          <p className="text-sm text-gray-400 leading-relaxed">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-2 mt-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-[#37373d] rounded-md transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            className={`px-4 py-2 text-xs font-medium text-white rounded-md transition-all ${
              isDestructive ? 'bg-red-500 hover:bg-red-600' : 'bg-[#2383e2] hover:bg-opacity-90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface InputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  message: string;
  placeholder?: string;
  submitLabel?: string;
  type?: string;
}

export function InputDialog({
  isOpen,
  onClose,
  onSubmit,
  title,
  message,
  placeholder = '',
  submitLabel = 'Submit',
  type = 'text'
}: InputDialogProps) {
  const [value, setValue] = React.useState('');

  React.useEffect(() => {
    if (isOpen) setValue('');
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit(value);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-gray-400 leading-relaxed">{message}</p>
        <input
          type={type}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus
          className="w-full bg-[#111] border border-[#3e3e3e] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
        />
        <div className="flex items-center justify-end gap-2 mt-2">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-[#37373d] rounded-md transition-all"
          >
            Cancel
          </button>
          <button 
            type="submit"
            disabled={!value.trim()}
            className="px-4 py-2 text-xs font-medium text-white bg-[#2383e2] hover:bg-opacity-90 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
