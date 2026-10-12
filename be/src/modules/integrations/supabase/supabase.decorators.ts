import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { SupabaseAdminClient, SupabasePublicClient } from "./supabase.client"
import type { VerifySupabaseAccessToken } from "./supabase.options"
import type { SupabaseAuthService } from "./supabase-auth.service"

/** Token of the integration's Auth and Storage administrator. */
export const SUPABASE_ADMIN_CLIENT: unique symbol = Symbol("integrations.supabase.admin-client")
/** Token of the publishable-key client. */
export const SUPABASE_PUBLIC_CLIENT: unique symbol = Symbol("integrations.supabase.public-client")
/** Token of the cryptographic Supabase access-token verifier. */
export const SUPABASE_ACCESS_TOKEN_VERIFIER: unique symbol = Symbol("integrations.supabase.access-token-verifier")
/** Token of the Auth service domains read accounts and deliver invitations through. */
export const SUPABASE_AUTH: unique symbol = Symbol("integrations.supabase.auth")

/** Injects the Auth and Storage administrator. Parameter type: SupabaseAdminClient. */
export const InjectSupabaseAdminClient = (): TypedParameterDecorator<SupabaseAdminClient> =>
    injector<SupabaseAdminClient>(SUPABASE_ADMIN_CLIENT)

/** Injects the publishable-key client. Parameter type: SupabasePublicClient. */
export const InjectSupabasePublicClient = (): TypedParameterDecorator<SupabasePublicClient> =>
    injector<SupabasePublicClient>(SUPABASE_PUBLIC_CLIENT)

/** Injects the access-token verifier. Parameter type: VerifySupabaseAccessToken. */
export const InjectSupabaseAccessTokenVerifier = (): TypedParameterDecorator<VerifySupabaseAccessToken> =>
    injector<VerifySupabaseAccessToken>(SUPABASE_ACCESS_TOKEN_VERIFIER)

/** Injects the Auth service. Parameter type: SupabaseAuthService. */
export const InjectSupabaseAuth = (): TypedParameterDecorator<SupabaseAuthService> =>
    injector<SupabaseAuthService>(SUPABASE_AUTH)
