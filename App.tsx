import React, { useEffect, useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { auth } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { User, UserProfile } from './types';
import { getOrCreateUserProfile } from './services/firestore';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Default to dark mode for premium feel
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Apply theme class to HTML element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
    } else {
        root.classList.remove('dark');
        root.classList.add('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Load saved theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const refreshProfile = async (uid: string) => {
      const profile = await getOrCreateUserProfile(uid, auth.currentUser?.email || null);
      setUserProfile(profile);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL
        });
        
        try {
            const profile = await getOrCreateUserProfile(firebaseUser.uid, firebaseUser.email);
            setUserProfile(profile);
        } catch (error) {
            console.error("Error fetching user profile:", error);
        }

      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
             <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-[#10b981]"></div>
             <p className="text-sm text-gray-500 animate-pulse">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="antialiased text-white selection:bg-[#10b981] selection:text-black">
      {user && userProfile ? (
        <Dashboard 
            user={user} 
            userProfile={userProfile} 
            refreshProfile={() => refreshProfile(user.uid)}
            theme={theme} 
            toggleTheme={toggleTheme} 
        />
      ) : (
        <LandingPage onLoginSuccess={() => {}} theme={theme} toggleTheme={toggleTheme} />
      )}
    </div>
  );
}

export default App;