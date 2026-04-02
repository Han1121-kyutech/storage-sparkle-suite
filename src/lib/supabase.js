import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rafupbgkkabuckrlwchn.supabase.co'
const supabaseKey = 'sb_publishable_uHMNmYO5raphSPGXqsuz3Q_rOyHfHH4'

export const supabase = createClient(supabaseUrl, supabaseKey)