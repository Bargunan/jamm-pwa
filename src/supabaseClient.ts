import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ccplyydjuhhhdhegdhhn.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjcGx5eWRqdWhoaGRoZWdkaGhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NTQ2NjcsImV4cCI6MjA3NTQzMDY2N30.2hVXUSRsciOf2n_S_SWKhDu9jGT9uxn3BKsD2JP1Fb0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)