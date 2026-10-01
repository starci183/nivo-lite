/** The one place the app reads its environment. */
const required = (name: string, value: string | undefined): string => {
  if (!value) throw new Error(`Missing environment variable ${name} (see secrets.example.env)`);
  return value;
};

export const publicConfig = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
};

export const serverConfig = () => ({
  deepseekApiKey: required("DEEPSEEK_API_KEY", process.env.DEEPSEEK_API_KEY),
  deepseekModel: process.env.DEEPSEEK_MODEL || "deepseek/deepseek-v4-flash",
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || "https://openrouter.ai/api/v1",
});
