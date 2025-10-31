import React, { createContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null);



export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null); // New state for access token
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const defaultOperatorPermissions = [
    'orders:view',
    'products:view',
    'events:view',
  ];

  const hasPermission = useCallback((permissionKey) => {
    if (!user) return false;
    // master 역할은 모든 권한을 가집니다.
    if (permissions.includes('master')) return true; // 'master' role itself acts as a wildcard
    return permissions.includes(permissionKey);
  }, [user, permissions]);

  useEffect(() => {
    const checkUserPermissions = (session) => {
      if (session?.user) {
        const userRole = session.user.app_metadata?.role;
        const userPermissions = session.user.app_metadata?.permissions || [];

        if (userRole === 'master') {
          setPermissions(['master']); // master는 모든 권한을 가짐을 나타내는 특수 값
        } else if (userPermissions.length > 0) {
          setPermissions(userPermissions);
        } else {
          // 역할이나 권한이 명시되지 않은 경우 기본 operator 권한 부여
          setPermissions(defaultOperatorPermissions);
        }
        setUser(session.user);
        setAccessToken(session.access_token); // Set access token here
      } else {
        setUser(null);
        setAccessToken(null); // Clear access token
        setPermissions([]);
      }
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      checkUserPermissions(session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      checkUserPermissions(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error logging out:", error.message);
    } else {
      setUser(null);
      setAccessToken(null); // Clear access token
      setPermissions([]);
    }
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, permissions, hasPermission, loading, setUser, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
