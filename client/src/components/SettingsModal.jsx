import React from 'react';
import { motion } from 'framer-motion';
import { IoClose, IoSettingsOutline } from 'react-icons/io5';

const SettingsModal = ({ onClose, gradientEnabled, onToggleGradient }) => {
    return (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
                className="w-full max-w-md bg-black/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative"
                initial={{ opacity: 0, scale: 0.9, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 12 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
                >
                    <IoClose size={24} />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center">
                        <IoSettingsOutline className="text-primary text-xl" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Settings</h2>
                </div>

                <div className="space-y-6">
                    {/* Option 1: Gradient */}
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex flex-col">
                            <span className="font-medium text-white">Dynamic Background</span>
                            <span className="text-xs text-zinc-400">Enable ambient color glow</span>
                        </div>
                        <button
                            onClick={onToggleGradient}
                            className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${gradientEnabled ? 'bg-primary' : 'bg-zinc-700'}`}
                        >
                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${gradientEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    {/* Attribution Footer */}
                    <div className="pt-6 mt-2 text-center border-t border-white/5">
                        <p className="text-[10px] text-zinc-600 font-semibold tracking-widest uppercase">
                            Designed & Developed by <a href="https://github.com/x9code/DrivePlayer-main/tree/main" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors underline-offset-2 hover:underline">Deepak Kumar Rana</a>
                        </p>
                        <p className="text-[8px] text-zinc-600 font-semibold tracking-widest uppercase">
                            Powered by <span className="text-zinc-400">Google - Antigravity</span>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default SettingsModal;
