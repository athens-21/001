import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AccountContext = createContext(null);

export const useAccount = () => {
    const context = useContext(AccountContext);
    if (!context) {
        throw new Error('useAccount must be used within AccountProvider');
    }
    return context;
};

export const AccountProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Check session on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                // Check if logged in via session by trying to fetch accounts
                const response = await api.get('/accounts');
                // If successful, user is logged in
                setUser({ authenticated: true });
            } catch (error) {
                if (error.response?.status === 401) {
                    // Not logged in
                    setUser(null);
                }
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    const login = () => {
        // Login handled by main system
        window.location.href = '/login';
    };

    const logout = () => {
        // Logout handled by main system
        window.location.href = '/logout';
    };

    const value = {
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
    };

    return (
        <AccountContext.Provider value={value}>
            {children}
        </AccountContext.Provider>
    );
};
