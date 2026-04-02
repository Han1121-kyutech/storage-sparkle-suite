import { createContext, useContext, useState, ReactNode } from 'react';
import { User } from '@/types';
import { mockUsers } from '@/data/mockData';

interface AuthContextType {
  currentUser: User | null;
  login: (userId: string) => void;
  logout: () => void;
  register: (userName: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  login: () => {},
  logout: () => {},
  register: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const login = (userId: string) => {
    const user = mockUsers.find((u) => u.id === userId) ?? null;
    setCurrentUser(user);
  };

  const logout = () => setCurrentUser(null);

  const register = (userName: string) => {
    const newUser: User = {
      id: `u-${String(mockUsers.length + 1).padStart(3, '0')}`,
      user_name: userName,
      role: 'general',
    };
    mockUsers.push(newUser);
    setCurrentUser(newUser);
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};
