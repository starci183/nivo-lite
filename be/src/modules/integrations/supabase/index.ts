export { parseSupabaseConfig } from "./supabase.config"
export type { SupabaseAdminClient } from "./supabase.client"
export {
    InjectSupabaseAdminClient,
    InjectSupabaseStorage,
    SUPABASE_ACCESS_TOKEN_VERIFIER,
    SUPABASE_ACCOUNTS,
    SUPABASE_STORAGE,
    SUPABASE_AUTH,
} from "./supabase.decorators"
export { SUPABASE_ERROR_KINDS } from "./errors/supabase.error"
export { createSupabaseAccessTokenVerifier } from "./supabase.jwks"
export { SupabaseModule } from "./supabase.module"
export type { SupabaseOptions, VerifySupabaseAccessToken } from "./supabase.options"
export type { SupabaseStorageService } from "./supabase-storage.service"
