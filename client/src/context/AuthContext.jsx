import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// Configure Axios Default
// We do this outside component to ensure it applies even before context loads, 
// but managing it inside is safer for reactivity.
// For now, we'll set it in useEffect.

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('driveplayer_token'));
    const [loading, setLoading] = useState(true);

    // API Base URL (same as App.jsx)
    const API_BASE = import.meta.env.VITE_API_URL || '';

    // Initialize Axios Header
    useMemo(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
            delete axios.defaults.headers.common['Authorization'];
        }
    }, [token]);

    // Check Token on Mount
    useEffect(() => {
        const initAuth = async () => {
            if (token) {
                try {
                    // Timeout after 8s to avoid blank screen on cold start
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 8000);
                    const res = await axios.get(`${API_BASE}/api/auth/me`, {
                        signal: controller.signal
                    });
                    clearTimeout(timeout);
                    setUser(res.data);
                } catch (err) {
                    if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
                        // Server timeout — skip auth silently, app still loads
                        console.warn('Auth check timed out (cold start?). Proceeding without auth.');
                    } else {
                        console.error("Auth Init Failed:", err);
                        logout(); // Invalid token
                    }
                }
            }
            setLoading(false);
        };
        initAuth();
    }, [token]);

    const login = async (username, password) => {
        try {
            const res = await axios.post(`${API_BASE}/api/auth/login`, { username, password });

            // Validation: Detect HTML response (SPA Fallback)
            const contentType = res.headers['content-type'];
            if (contentType && contentType.includes('text/html')) {
                throw new Error('Server returned HTML instead of JSON. Check VITE_API_URL configuration.');
            }

            // Validation: Check for token/user
            if (!res.data || !res.data.token || !res.data.user) {
                console.error("Login Response Invalid:", res.data);
                throw new Error("Invalid server response (Missing token/user)");
            }

            const { token, user } = res.data;
            localStorage.setItem('driveplayer_token', token);
            setToken(token);
            setUser(user);
            return { success: true };
        } catch (err) {
            console.error("Login Error:", err);
            return { success: false, error: err.response?.data?.error || err.message || "Login failed" };
        }
    };

    const register = async (username, password) => {
        try {
            const res = await axios.post(`${API_BASE}/api/auth/register`, { username, password });

            // Validation: Detect HTML response (SPA Fallback)
            const contentType = res.headers['content-type'];
            if (contentType && contentType.includes('text/html')) {
                throw new Error('Server returned HTML instead of JSON. Check VITE_API_URL configuration.');
            }

            // Validation: Check for token/user
            if (!res.data || !res.data.token || !res.data.user) {
                console.error("Register Response Invalid:", res.data);
                throw new Error("Invalid server response (Missing token/user)");
            }

            const { token, user } = res.data;
            localStorage.setItem('driveplayer_token', token);
            setToken(token);
            setUser(user);
            return { success: true };
        } catch (err) {
            console.error("Register Error:", err);
            return { success: false, error: err.response?.data?.error || err.message || "Registration failed" };
        }
    };

    const logout = () => {
        localStorage.removeItem('driveplayer_token');
        setToken(null);
        setUser(null);
    };

    const deleteAccount = async () => {
        try {
            const res = await axios.delete(`${API_BASE}/api/auth/account`);
            if (res.data.success) {
                logout();
                return { success: true };
            }
            return { success: false, error: "Failed to delete account" };
        } catch (err) {
            console.error("Delete Account Error:", err);
            return { success: false, error: err.response?.data?.error || "Failed to delete account" };
        }
    };

    const updateUser = (data) => {
        setUser(prev => ({ ...prev, ...data }));
    };

    const value = {
        user,
        token,
        loading,
        login,
        register,
        logout,
        deleteAccount,
        updateUser,
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
