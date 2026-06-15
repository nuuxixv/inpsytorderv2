import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qnrojyamcrvikbezkzwk.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// 세션은 localStorage에 보관하고 토큰(수명 1h)을 자동 갱신한다.
// 작성 중 토큰 만료로 화면이 통째로 언마운트되던 문제(세션 팅김)를 막기 위한 설정.
// 보안 만료는 storage 휘발이 아니라 AuthContext의 비활동 8시간 자동 로그아웃이 담당한다.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  }
});
