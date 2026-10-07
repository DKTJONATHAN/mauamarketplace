const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const env = {
  supabaseUrl: url ?? '',
  supabaseKey: key ?? '',
  configured: Boolean(url && key),
};
