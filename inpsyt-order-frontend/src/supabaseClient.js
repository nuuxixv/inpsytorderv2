import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qnrojyamcrvikbezkzwk.supabase.co' 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucm9qeWFtY3J2aWtiZXprendrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMjY4OTYsImV4cCI6MjA2NzYwMjg5Nn0.CPuCkNTzyawuCylUohWDfgerd-UhQNhh5guSC_uNz78'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
