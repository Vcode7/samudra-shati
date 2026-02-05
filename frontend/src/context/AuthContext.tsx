import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../services/api';

type UserType = 'user' | 'authority' | null;

interface User {
    id: number;
    phone_number?: string;
    username?: string;
    primary_language: string;
    secondary_language?: string;
    trust_score?: number;
}

interface AuthContextType {
    isAuthenticated: boolean;
    userType: UserType;
    user: User | null;
    token: string | null;
    login: (token: string, userType: UserType) => Promise<void>;
    logout: () => Promise<void>;
    updateUser: (userData: Partial<User>) => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userType, setUserType] = useState<UserType>(null);
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAuthState();
    }, []);

    const loadAuthState = async () => {
        try {
            const [storedToken, storedUserType] = await Promise.all([
                AsyncStorage.getItem('auth_token'),
                AsyncStorage.getItem('user_type'),
            ]);

            if (storedToken && storedUserType) {
                const api = await apiClient();
                // 🔥 Attach token BEFORE API calls
                api.defaults.headers.common.Authorization = `Bearer ${storedToken}`;

                setToken(storedToken);
                setUserType(storedUserType as UserType);
                setIsAuthenticated(true);

                await fetchUserProfile(storedUserType as UserType);
            }
        } catch (error) {
            console.error('Error loading auth state:', error);
        } finally {
            setLoading(false);
        }
    };


    const fetchUserProfile = async (type: UserType) => {
        try {
            const endpoint = type === 'authority' ? '/api/authorities/me' : '/api/users/me';
            const api = await apiClient();
            const response = await api.get(endpoint);
            setUser(response.data);
        } catch (error) {
            console.error('Error fetching user profile:', error);
            await logout();
        }
    };

    const login = async (newToken: string, newUserType: UserType) => {
        try {
            const api = await apiClient();
            await AsyncStorage.setItem('auth_token', newToken);
            await AsyncStorage.setItem('user_type', newUserType || 'user');
            // 2️⃣ Attach token to axios
            api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
            console.log(
                'LOGIN HEADER:',
                api.defaults.headers.common.Authorization
            );
            setToken(newToken);
            setUserType(newUserType);
            setIsAuthenticated(true);
            await fetchUserProfile(newUserType);
        } catch (error) {
            console.error('Error during login:', error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await AsyncStorage.multiRemove(['auth_token', 'user_type']);
            setToken(null);
            setUserType(null);
            setUser(null);
            setIsAuthenticated(false);
        } catch (error) {
            console.error('Error during logout:', error);
        }
    };

    const updateUser = (userData: Partial<User>) => {
        setUser((prev) => (prev ? { ...prev, ...userData } : null));
    };

    return (
        <AuthContext.Provider
            value={{
                isAuthenticated,
                userType,
                user,
                token,
                login,
                logout,
                updateUser,
                loading,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
