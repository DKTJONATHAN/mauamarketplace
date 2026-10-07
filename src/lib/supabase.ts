import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// When the env vars are missing the app renders a setup screen instead of crashing,
// so we still need a syntactically valid client here.
export const supabase = createClient(env.supabaseUrl || 'http://localhost:54321', env.supabaseKey || 'missing-key', {
  auth: {
    flowType: 'pkce', // OAuth and email links return ?code=..., which works with the hash router
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
