export { parseSupabaseConfig } from "./supabase.config"
export type { SignedUpload, StorageFailureCode, StoredObject } from "./supabase.contracts"
export type { SupabaseAdminClient } from "./supabase.client"
export {
    InjectSupabaseAdminClient,
    InjectSupabaseObjects,
    SUPABASE_ACCESS_TOKEN_VERIFIER,
    SUPABASE_ACCOUNTS,
    SUPABASE_AUTH,
    SUPABASE_OBJECTS,
    SUPABASE_STORAGE,
} from "./supabase.decorators"
export type { SupabaseObjectsPort } from "./supabase.port"
export { SUPABASE_ERROR_KINDS } from "./errors/supabase.error"
export { createSupabaseAccessTokenVerifier } from "./supabase.jwks"
export { SupabaseModule } from "./supabase.module"
export type { SupabaseOptions, VerifySupabaseAccessToken } from "./supabase.options"
