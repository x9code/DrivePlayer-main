import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { IoWarning, IoClose, IoTrash, IoAlertCircle, IoMail } from 'react-icons/io5';

const DeleteAccountModal = ({ isOpen, onClose }) => {
    const { deleteAccount, user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const handleConfirmDelete = async () => {
        setLoading(true);
        setError(null);
        const result = await deleteAccount();
        if (!result.success) {
            setLoading(false);
            setError(result.error);
        }
        // If success, AuthContext handles logout and the modal disappears
    };

    const handleClose = () => {
        setError(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-zinc-900 border border-red-500/20 rounded-2xl shadow-2xl shadow-red-900/20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center">
                            <IoTrash className="text-red-400" size={18} />
                        </div>
                        <h2 className="text-white font-bold text-lg">Delete Account</h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-all"
                    >
                        <IoClose size={20} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-300 text-sm">
                            <IoAlertCircle size={18} className="shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3">
                        <IoWarning className="text-red-400 shrink-0 mt-0.5" size={20} />
                        <div className="text-sm text-zinc-300 space-y-1">
                            <p className="font-semibold text-red-300">This action is permanent and cannot be undone.</p>
                            <p className="text-zinc-400">All your favorites, playlists, and account data will be deleted forever.</p>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button
                            onClick={handleClose}
                            className="flex-1 py-3 rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5 transition-all text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirmDelete}
                            disabled={loading}
                            className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-all text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <IoTrash size={16} />
                                    Delete Forever
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeleteAccountModal;
