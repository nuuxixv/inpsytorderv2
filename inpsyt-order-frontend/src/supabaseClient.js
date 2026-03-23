import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qnrojyamcrvikbezkzwk.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// sessionStorage를 사용하도록 클라이언트 설정 변경
// 브라우저/탭을 닫으면 세션이 만료됩니다.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: sessionStorage,
  }
});
