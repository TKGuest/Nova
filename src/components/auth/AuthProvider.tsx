'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider } from '@/lib/firebase';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      console.error("Login failed: ", e);
      if (e.code === 'auth/popup-blocked') {
        alert("Your browser blocked the sign-in popup. Please allow popups for this site and try again.");
      } else {
        alert(`Sign-in error: ${e.message}`);
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {loading ? (
        <div className="min-h-screen bg-background flex flex-col justify-center items-center text-foreground">
          <Loader2 className="animate-spin mb-4" size={32} />
          <p>Authenticating with Nova...</p>
        </div>
      ) : user ? (
        children
      ) : (
        <div className="min-h-screen bg-background flex flex-col justify-center items-center p-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">Workspace</h1>
          <p className="text-gray-400 mb-8 text-center max-w-sm">Sign in with Google to synchronize your workspace, databases, and habits seamlessly securely with your Firebase configuration.</p>
          <button 
            onClick={login}
            className="bg-accent text-white px-6 py-3 rounded-md hover:bg-opacity-90 flex items-center gap-3 font-medium transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>
      )}
    </AuthContext.Provider>
  );
}
