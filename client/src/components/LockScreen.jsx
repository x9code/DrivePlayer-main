import React, { useState } from 'react';
import { IoLockClosedOutline } from 'react-icons/io5';

const LockScreen = ({ onUnlock, isLocked }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);
    const [shake, setShake] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        // Get PIN from localStorage first, then environment variable (default to 0000 if not set)
        const sPin = localStorage.getItem('driveplayer_pin');
        const correctPin = sPin || import.meta.env.VITE_APP_PIN || '0000';

        if (pin === correctPin) {
            onUnlock();
            setPin(''); // Clear PIN on unlock for next time
        } else {
            setError(true);
            setShake(true);
            setPin('');
            setTimeout(() => setShake(false), 500);
        }
    };

    return (
        <div
            className={`fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 transition-all duration-500 ease-in-out ${isLocked ? 'opacity-100 backdrop-blur-xl pointer-events-auto' : 'opacity-0 backdrop-blur-none pointer-events-none'}`}
        >
            <div className={`w-full max-w-sm bg-zinc-900/80 backdrop-blur-2xl border border-white/10 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6 transition-all duration-500 ${shake ? 'animate-shake' : ''} ${isLocked ? 'scale-100 translate-y-0' : 'scale-110 translate-y-4'}`}>
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-2 shadow-lg">
                    <IoLockClosedOutline className="text-primary text-3xl" />
                </div>

                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">App Locked</h2>
                    <p className="text-zinc-400 text-sm">Enter PIN to access DrivePlayer</p>
                </div>

                <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
                    <input
                        type="password"
                        inputMode="numeric"
                        value={pin}
                        onChange={(e) => {
                            setPin(e.target.value);
                            setError(false);
                        }}
                        className={`w-full bg-black/50 border ${error ? 'border-red-500 text-red-500' : 'border-white/10 text-white focus:border-primary'} rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] outline-none transition-colors placeholder:tracking-normal`}
                        placeholder="••••"
                        autoFocus
                    />

                    {error && <p className="text-red-500 text-xs text-center font-bold">Incorrect PIN</p>}

                    <button
                        type="submit"
                        className="w-full bg-primary text-black font-bold py-3 rounded-xl hover:opacity-90 transition-opacity mt-2"
                    >
                        Unlock
                    </button>
                </form>
            </div>

            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                    20%, 40%, 60%, 80% { transform: translateX(5px); }
                }
                .animate-shake {
                    animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
                }
            `}</style>
        </div>
    );
};

export default LockScreen;
