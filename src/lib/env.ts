const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export const env = {
  supabaseUrl: url ?? '',
  supabaseKey: key ?? '',
  googleClientId: googleClientId ?? '',
  configured: Boolean(url && key),
};
