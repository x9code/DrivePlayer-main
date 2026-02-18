import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { IoMusicalNotes, IoArrowForward, IoPersonAdd, IoLogIn, IoAlertCircle } from 'react-icons/io5';

const AuthScreen = () => {
    const { login, register } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError(null); // Clear error on type
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const action = isLogin ? login : register;
        const result = await action(formData.email, formData.password);

        if (!result.success) {
            setError(result.error);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen w-full bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-black z-0" />
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/30 rounded-full blur-[128px] animate-pulse-slower" />
            <div className="absolute top-1/2 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-[128px] animate-pulse-slower delay-1000" />

            {/* Auth Card */}
            <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl z-10 relative overflow-hidden">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-tr from-purple-600 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30">
                        <IoMusicalNotes className="text-3xl text-white" />
                    </div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        DrivePlayer
                    </h1>
                    <p className="text-zinc-400 mt-2 text-sm">
                        {isLogin ? 'Welcome back! Login to continue.' : 'Join to start streaming your music.'}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3 text-red-200 text-sm animate-in fade-in slide-in-from-top-2">
                            <IoAlertCircle size={20} className="shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 ml-1">Email</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
                                placeholder="you@example.com"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 ml-1">Password</label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-white text-black font-bold py-3.5 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-white/20 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        ) : (
                            <>
                                {isLogin ? 'Sign In' : 'Create Account'}
                                <IoArrowForward size={18} />
                            </>
                        )}
                    </button>
                </form>

                {/* Toggle Mode */}
                <div className="mt-8 pt-6 border-t border-white/5 text-center">
                    <p className="text-zinc-400 text-sm">
                        {isLogin ? "Don't have an account?" : "Already have an account?"}
                        <button
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError(null);
                                setFormData({ email: '', password: '' });
                            }}
                            className="ml-2 text-white font-medium hover:underline focus:outline-none"
                        >
                            {isLogin ? 'Register' : 'Login'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthScreen;
