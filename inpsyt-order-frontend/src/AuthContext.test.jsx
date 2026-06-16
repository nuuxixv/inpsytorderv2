// AuthContext 비활동 8시간 자동 로그아웃 핫픽스 회귀 테스트.
// 버그: 신규 로그인(SIGNED_IN) 직후, localStorage에 남은 직전 세션(수개월 전)의
//       lastActivity 때문에 진입 검사가 8시간 초과로 판정 → 로그인 즉시 튕김.
// 수정: SIGNED_IN은 명백한 활동이므로 그 시점을 lastActivity로 stamp.
//       복원 세션(INITIAL_SESSION/getSession)·TOKEN_REFRESHED는 stamp 안 함(회귀 보호).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';

const ACTIVITY_KEY = 'inpsyt:lastActivity';
const NINE_HOURS = 9 * 60 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

// supabase 클라이언트 mock — onAuthStateChange 콜백을 캡처해 테스트에서 직접 발화.
const { authMock, signOutSpy, capture } = vi.hoisted(() => {
  const capture = { cb: null, initialSession: null };
  const signOutSpy = vi.fn(() => Promise.resolve({ error: null }));
  const authMock = {
    getSession: vi.fn(() => Promise.resolve({ data: { session: capture.initialSession } })),
    onAuthStateChange: vi.fn((cb) => {
      capture.cb = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signOut: signOutSpy,
    refreshSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
  };
  return { authMock, signOutSpy, capture };
});

vi.mock('./supabaseClient', () => ({
  supabase: {
    auth: authMock,
    // checkUserPermissions가 user_profiles를 조회하므로 무해한 stub 체인 제공.
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null })),
        })),
      })),
    })),
  },
}));

import { AuthProvider } from './AuthContext';

const SESSION = {
  access_token: 'tok',
  user: { id: 'u-1', app_metadata: { role: 'master' } },
};

beforeEach(() => {
  localStorage.clear();
  capture.cb = null;
  capture.initialSession = null;
  signOutSpy.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

const renderProvider = async () => {
  render(<AuthProvider><div>child</div></AuthProvider>);
  // getSession().then(...) 마이크로태스크 소진 + onAuthStateChange 등록 대기.
  await waitFor(() => expect(capture.cb).toBeTypeOf('function'));
};

describe('AuthContext — 비활동 자동 로그아웃 핫픽스', () => {
  it('케이스1(버그 재현→GREEN): 옛 lastActivity(9h 전)가 있어도 SIGNED_IN이면 로그아웃 안 됨', async () => {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - NINE_HOURS));
    await renderProvider();

    await act(async () => {
      capture.cb('SIGNED_IN', SESSION);
      await Promise.resolve();
    });

    // SIGNED_IN이 lastActivity를 방금 시각으로 stamp → 진입 검사에서 doLogout 안 함.
    expect(signOutSpy).not.toHaveBeenCalled();
    const stamped = parseInt(localStorage.getItem(ACTIVITY_KEY), 10);
    expect(Date.now() - stamped).toBeLessThan(ONE_HOUR);
  });

  it('케이스2(회귀 보호): 복원 세션(INITIAL_SESSION via getSession)이 9h+ 유휴면 로그아웃됨', async () => {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - NINE_HOURS));
    capture.initialSession = SESSION; // 앱 로드 시 getSession이 복원 세션 반환

    await renderProvider();
    // 복원 경로(getSession)는 SIGNED_IN stamp가 없으므로 진입 검사에서 만료 판정 → 로그아웃.
    await waitFor(() => expect(signOutSpy).toHaveBeenCalled());
  });

  it('케이스3(정상 보존): 최근(1h 전) 활동 + SIGNED_IN이면 로그아웃 안 됨', async () => {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - ONE_HOUR));
    await renderProvider();

    await act(async () => {
      capture.cb('SIGNED_IN', SESSION);
      await Promise.resolve();
    });

    expect(signOutSpy).not.toHaveBeenCalled();
  });
});
