import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { IoClose, IoMail, IoArrowForward, IoCheckmarkCircle } from 'react-icons/io5';
import axios from 'axios';

const ForgotPasswordModal = ({ isOpen, onClose, API_BASE }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await axios.post(`${API_BASE}/api/auth/forgot-password`, { email });
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to send reset link");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <motion.div
                className="relative bg-[#121212] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl"
                initial={{ opacity: 0, scale: 0.9, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 16 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
                >
                    <IoClose size={24} />
                </button>

                <h2 className="text-2xl font-bold text-white mb-2">Reset Password</h2>

                {!success ? (
                    <>
                        <p className="text-zinc-400 mb-6 text-sm">
                            Enter your email address and we'll send you a link to reset your password.
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5 ml-1">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <IoMail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
                                        placeholder="you@example.com"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-white text-black font-bold py-3.5 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                ) : (
                                    <>
                                        Send Reset Link
                                        <IoArrowForward />
                                    </>
                                )}
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="text-center py-6">
                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500">
                            <IoCheckmarkCircle size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Check your email</h3>
                        <p className="text-zinc-400 mb-6">
                            We've sent a password reset link to <br />
                            <span className="text-white font-medium">{email}</span>
                        </p>
                        <button
                            onClick={onClose}
                            className="w-full bg-white/10 hover:bg-white/20 text-white font-medium py-3 rounded-xl transition-colors"
                        >
                            Return to Login
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default ForgotPasswordModal;
