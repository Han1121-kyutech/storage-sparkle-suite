import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rafupbgkkabuckrlwchn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhZnVwYmdra2FidWNrcmx3Y2huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjI3OTIsImV4cCI6MjA5MDY5ODc5Mn0.93YIxm6_GCn3dAu5_1mo5ZCW6CPmU1ytIgB1FtRQNxw'

export const supabase = createClient(supabaseUrl, supabaseKey)