import React, { useState } from 'react';
import { IoLockClosedOutline } from 'react-icons/io5';
import axios from 'axios';

const LockScreen = ({ onUnlock, isLocked }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);
    const [shake, setShake] = useState(false);

    // Reset Flow State
    const [isResetting, setIsResetting] = useState(false);
    const [otp, setOtp] = useState('');
    const [newPin, setNewPin] = useState('');
    const [resetStep, setResetStep] = useState('OTP'); // 'OTP' -> 'VERIFY'
    const [resetError, setResetError] = useState('');
    const [resetSuccess, setResetSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        // Get PIN from localStorage first, then environment variable
        const sPin = localStorage.getItem('driveplayer_pin');
        const correctPin = sPin || import.meta.env.VITE_APP_PIN;

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

    // --- Forgot PIN Logic ---
    const handleRequestOtp = async (e) => {
        e.preventDefault();
        setResetError('');
        setResetSuccess('');
        setLoading(true);

        try {
            // Using the same endpoint as SettingsModal
            const API_BASE = import.meta.env.VITE_API_URL || '';
            await axios.post(`${API_BASE}/api/auth/otp/send`);
            setResetSuccess('OTP sent to registered phone ending in 5796');
            setResetStep('VERIFY');
        } catch (err) {
            setResetError('Failed to send OTP. Server error.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setResetError('');
        setResetSuccess('');

        if (newPin.length < 4) {
            setResetError('New PIN must be at least 4 digits');
            return;
        }

        setLoading(true);
        try {
            const API_BASE = import.meta.env.VITE_API_URL || '';
            const res = await axios.post(`${API_BASE}/api/auth/otp/verify`, { otp });

            if (res.data.valid) {
                // Success! Save New PIN and Unlock
                localStorage.setItem('driveplayer_pin', newPin);
                setResetSuccess('PIN Reset Successfully! Unlocking...');

                setTimeout(() => {
                    onUnlock();
                    // Reset State
                    setIsResetting(false);
                    setResetStep('OTP');
                    setOtp('');
                    setNewPin('');
                    setPin('');
                }, 1000);
            } else {
                setResetError(res.data.message || 'Invalid OTP');
            }
        } catch (err) {
            setResetError('Verification failed');
            console.error(err);
        } finally {
            setLoading(false);
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

                {!isResetting ? (
                    <>
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
                                autoFocus={isLocked && !isResetting}
                            />

                            {error && <p className="text-red-500 text-xs text-center font-bold">Incorrect PIN</p>}

                            <button
                                type="submit"
                                className="w-full bg-primary text-black font-bold py-3 rounded-xl hover:opacity-90 transition-opacity mt-2"
                            >
                                Unlock
                            </button>
                        </form>

                        <button
                            onClick={() => setIsResetting(true)}
                            className="text-xs text-zinc-500 hover:text-white transition-colors mt-2"
                        >
                            Forgot PIN?
                        </button>
                    </>
                ) : (
                    // --- RESET FLOW UI ---
                    <div className="w-full flex flex-col gap-4 animate-in fade-in duration-300">
                        <div className="text-center mb-2">
                            <h2 className="text-xl font-bold text-white">Reset PIN</h2>
                            <p className="text-zinc-400 text-xs">
                                {resetStep === 'OTP' ? 'Request a code to reset your PIN' : 'Enter code and new PIN'}
                            </p>
                        </div>

                        {resetStep === 'OTP' ? (
                            <div className="flex flex-col gap-4">
                                <p className="text-sm text-zinc-300 text-center bg-white/5 p-3 rounded-lg border border-white/5">
                                    We will send a One-Time Password to your registered phone number.
                                </p>

                                {resetError && <p className="text-red-500 text-xs text-center font-bold">{resetError}</p>}
                                {resetSuccess && <p className="text-green-500 text-xs text-center font-bold">{resetSuccess}</p>}

                                <button
                                    onClick={handleRequestOtp}
                                    disabled={loading}
                                    className="w-full bg-primary text-black font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                    {loading ? 'Sending...' : 'Send OTP'}
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">Enter OTP Code</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-3 text-center text-xl tracking-widest text-white focus:border-primary outline-none"
                                        placeholder="••••••"
                                        maxLength={6}
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">New PIN</label>
                                    <input
                                        type="password"
                                        inputMode="numeric"
                                        value={newPin}
                                        onChange={(e) => setNewPin(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-3 text-center text-xl tracking-[0.5em] text-white focus:border-primary outline-none"
                                        placeholder="••••"
                                        maxLength={4}
                                        required
                                    />
                                </div>

                                {resetError && <p className="text-red-500 text-xs text-center font-bold">{resetError}</p>}
                                {resetSuccess && <p className="text-green-500 text-xs text-center font-bold">{resetSuccess}</p>}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-primary text-black font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                    {loading ? 'Verifying...' : 'Set New PIN & Unlock'}
                                </button>
                            </form>
                        )}

                        <button
                            onClick={() => {
                                setIsResetting(false);
                                setResetStep('OTP');
                                setResetError('');
                            }}
                            className="text-xs text-zinc-500 hover:text-white transition-colors mt-2 text-center"
                        >
                            Cancel
                        </button>
                    </div>
                )}
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
