import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isMaster, setIsMaster] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUserRole = (session) => {
      console.log("Auth state changed, session object:", session); // <-- 디버깅 로그 추가
      if (session?.user) {
        console.log("User metadata:", session.user.user_metadata); // <-- 디버깅 로그 추가
        const userRole = session.user.app_metadata?.role || ''; // app_metadata에서 role 읽기
        console.log("Extracted user role:", userRole); // <-- 디버깅 로그 추가
        setIsMaster(userRole === 'master');
        console.log("Is master:", userRole === 'master'); // <-- 디버깅 로그 추가
        setUser(session.user);
      } else {
        setUser(null);
        setIsMaster(false);
      }
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      checkUserRole(session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      checkUserRole(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // 로그아웃 함수 추가
  const logout = async () => {
    setLoading(true); // 로그아웃 중 로딩 상태 표시
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error logging out:", error.message);
    } else {
      setUser(null); // 사용자 상태 초기화
      setIsMaster(false); // 마스터 상태 초기화
      // navigate('/login'); // 여기서는 navigate를 직접 호출하지 않습니다.
    }
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, isMaster, loading, setUser, logout }}> {/* logout 추가 */}
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
