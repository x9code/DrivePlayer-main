import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { IoWarningOutline } from 'react-icons/io5';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
        } else {
            const timer = setTimeout(() => setIsVisible(false), 200);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isVisible && !isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onCancel} // Click outside to close
        >
            <motion.div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
                initial={{ opacity: 0, scale: 0.9, y: 12 }}
                animate={{ opacity: isOpen ? 1 : 0, scale: isOpen ? 1 : 0.9, y: isOpen ? 0 : 12 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            >
                <div className="flex items-start gap-4 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                        <IoWarningOutline className="text-red-400 text-xl" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
                        <p className="text-sm text-zinc-400 leading-relaxed">{message}</p>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 rounded-xl text-sm font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default ConfirmModal;
