import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null);

const INACTIVITY_LIMIT_MS = 8 * 60 * 60 * 1000; // 무조작 8시간
const ACTIVITY_KEY = 'inpsyt:lastActivity';     // 탭 간 공유용
const ACTIVITY_THROTTLE_MS = 30 * 1000;         // 활동 기록 throttle(쓰기 폭주 방지)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null); // New state for access token
  const [permissions, setPermissions] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // 토큰 갱신 재시도 중에는 잠깐 session이 없어도 로그인 페이지로 튕기지 않도록 보호한다.
  const [refreshing, setRefreshing] = useState(false);

  const userRef = useRef(null);
  userRef.current = user;

  const hasPermission = useCallback((permissionKey) => {
    if (!user) return false;
    // master 역할은 모든 권한을 가집니다.
    if (permissions.includes('master')) return true; // 'master' role itself acts as a wildcard
    return permissions.includes(permissionKey);
  }, [user, permissions]);

  useEffect(() => {
    let active = true;

    const checkUserPermissions = (session) => {
      if (!active) return;
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
          .then(({ data }) => { if (data && active) setProfile(data); });
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

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESHED: 정상 자동 갱신 — user 유지(끊기지 않음).
      // SIGNED_IN / INITIAL_SESSION: 세션 반영.
      if (event === 'SIGNED_OUT') {
        checkUserPermissions(null);
        return;
      }
      if (session) {
        setRefreshing(false);
        checkUserPermissions(session);
        return;
      }
      // 명시적 SIGNED_OUT이 아닌데 session이 사라진 경우(만료·일시 오류):
      // 즉시 로그아웃하지 말고 1회 refreshSession() 재시도. 그동안 ProtectedRoute는 refreshing을 보고 대기.
      if (userRef.current) {
        setRefreshing(true);
        supabase.auth.refreshSession().then(({ data, error }) => {
          if (!active) return;
          setRefreshing(false);
          if (error || !data?.session) {
            checkUserPermissions(null); // 재시도 실패 → 실제 로그아웃
          } else {
            checkUserPermissions(data.session);
          }
        });
      } else {
        checkUserPermissions(null);
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // 비활동 8시간 자동 로그아웃 + 탭 복귀 시 세션 강제 갱신.
  // 활동(작성·클릭·스크롤 등)은 lastActivity를 갱신해 타이머를 리셋 → 작성 중에는 절대 안 풀린다.
  useEffect(() => {
    if (!user) return;

    let timerId = null;
    let lastWrite = 0;

    const readLastActivity = () => {
      const raw = localStorage.getItem(ACTIVITY_KEY);
      const parsed = raw ? parseInt(raw, 10) : NaN;
      return Number.isFinite(parsed) ? parsed : Date.now();
    };

    const doLogout = async () => {
      await supabase.auth.signOut(); // localStorage 전체 clear 금지 — 세션만 정리(임시저장 draft 보존)
    };

    const scheduleCheck = () => {
      if (timerId) clearTimeout(timerId);
      const remaining = INACTIVITY_LIMIT_MS - (Date.now() - readLastActivity());
      if (remaining <= 0) {
        doLogout();
        return;
      }
      timerId = setTimeout(scheduleCheck, remaining);
    };

    const markActivity = () => {
      const now = Date.now();
      if (now - lastWrite < ACTIVITY_THROTTLE_MS) return; // throttle
      lastWrite = now;
      localStorage.setItem(ACTIVITY_KEY, String(now));
      scheduleCheck();
    };

    // 탭 복귀: 백그라운드 throttling으로 자동 갱신이 밀렸을 수 있어 강제 갱신 + 만료 검사.
    const onFocus = () => {
      if (Date.now() - readLastActivity() >= INACTIVITY_LIMIT_MS) {
        doLogout();
        return;
      }
      supabase.auth.getSession().then(({ data }) => {
        if (!data?.session) supabase.auth.refreshSession();
      });
      scheduleCheck();
    };
    const onVisibility = () => { if (!document.hidden) onFocus(); };

    const activityEvents = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    activityEvents.forEach((ev) => window.addEventListener(ev, markActivity, { passive: true }));
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    // 진입(로그인 직후 포함) 시 활동 기록 + 이미 초과 상태인지 검사.
    if (Date.now() - readLastActivity() >= INACTIVITY_LIMIT_MS) {
      doLogout();
    } else {
      localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
      lastWrite = Date.now();
      scheduleCheck();
    }

    return () => {
      if (timerId) clearTimeout(timerId);
      activityEvents.forEach((ev) => window.removeEventListener(ev, markActivity));
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user]);

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
    <AuthContext.Provider value={{ user, accessToken, permissions, profile, hasPermission, loading, refreshing, setUser, logout, refreshProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
