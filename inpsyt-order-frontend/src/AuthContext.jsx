import React, { createContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null);



export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null); // New state for access token
  const [permissions, setPermissions] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

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
          // 권한이 JWT에 없으면 = 미인가. 프론트에서 임의 부여 금지(서버 RLS와 정합).
          // 임의 기본권한 부여 시 "메뉴는 보이는데 데이터는 RLS에 막히는" 엇박 발생(2026-06-01 건우님).
          setPermissions([]);
        }
        setUser(session.user);
        setAccessToken(session.access_token); // Set access token here
        // Fetch display name/role/department from user_profiles table
        supabase
          .from('user_profiles')
          .select('name, role, department')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => { if (data) setProfile(data); });
      } else {
        setUser(null);
        setAccessToken(null); // Clear access token
        setPermissions([]);
        setProfile(null);
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

  // 본인 정보(이름·부서) 수정 후 헤더 등에 즉시 반영하기 위해 프로필만 다시 조회.
  // (재로그인 없이 캐시 갱신 — 캐시 자체는 성능상 유지)
  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('user_profiles')
      .select('name, role, department')
      .eq('id', user.id)
      .single();
    if (data) setProfile(data);
  }, [user]);

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
    <AuthContext.Provider value={{ user, accessToken, permissions, profile, hasPermission, loading, setUser, logout, refreshProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
