export { parseSupabaseConfig } from "./supabase.config"
export type { InviteDelivery } from "./supabase.contracts"
export {
    InjectSupabaseAuth,
    SUPABASE_ACCESS_TOKEN_VERIFIER,
    SUPABASE_AUTH,
} from "./supabase.decorators"
export { SUPABASE_ERROR_KINDS, SupabaseErrorCode } from "./errors/supabase.error"
export { createSupabaseAccessTokenVerifier } from "./supabase.jwks"
export type { SupabaseAuthService } from "./supabase-auth.service"
export { SupabaseModule } from "./supabase.module"
export type { SupabaseOptions, VerifySupabaseAccessToken } from "./supabase.options"
