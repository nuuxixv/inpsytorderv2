import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = 'https://qnrojyamcrvikbezkzwk.supabase.co' 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucm9qeWFtY3J2aWtiZXprendrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMjY4OTYsImV4cCI6MjA2NzYwMjg5Nn0.CPuCkNTzyawuCylUohWDfgerd-UhQNhh5guSC_uNz78'

// sessionStorage를 사용하도록 클라이언트 설정 변경
// 브라우저/탭을 닫으면 세션이 만료됩니다.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: sessionStorage,
  }
});
