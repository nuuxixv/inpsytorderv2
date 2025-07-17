import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [masterPassword, setMasterPassword] = useState(null); // Assuming master password is set elsewhere or hardcoded for now

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setLoading(false);
    });

    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setLoading(false);
    });

    // For demonstration, setting a dummy master password. In a real app, this would be securely managed.
    // You might fetch this from an environment variable or a secure configuration.
    setMasterPassword('your_master_password_here');

    return () => {
      if (authListener && authListener.data && authListener.data.subscription) {
        authListener.data.subscription.unsubscribe();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, masterPassword, setUser }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
