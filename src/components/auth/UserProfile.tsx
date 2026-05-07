'use client';
import { useAuth } from './AuthProvider';
import { LogOut } from 'lucide-react';

export function UserProfile() {
  const { user, logout } = useAuth();
  
  if (!user) return null;

  return (
    <div className="p-4 border-t border-border flex items-center justify-between text-sm bg-[#1e1e1e]">
      <div className="flex items-center gap-2 truncate">
        {user.photoURL ? (
          <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-bold">
            {user.email?.[0].toUpperCase() || 'U'}
          </div>
        )}
        <span className="truncate text-gray-300 ml-1">{user.displayName || user.email}</span>
      </div>
      <button onClick={logout} className="text-gray-500 hover:text-white p-2 transition-colors" title="Sign out">
        <LogOut size={16} />
      </button>
    </div>
  );
}
