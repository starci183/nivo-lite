import type { DynamicModule, Provider } from "@nestjs/common"
import { IdentityModule } from "@modules/domain/identity"
import { ApiCredentialAuthenticatorService, ApiCredentialsModule } from "@modules/domain/api-credentials"
import {
    SUPABASE_ACCESS_TOKEN_VERIFIER,
    SupabaseModule,
    type VerifySupabaseAccessToken,
} from "@modules/integrations/supabase"
import type { ApiOptions } from "../api.options"

/** Registers authentication with the same verifier used by app-wide consumers. */
export const authenticationModules = (
    options: ApiOptions,
    verifyAccessToken: VerifySupabaseAccessToken,
): Array<DynamicModule> => [
    SupabaseModule.register({ isGlobal: true, ...options.supabase }),
    ApiCredentialsModule.register({ isGlobal: true }),
    IdentityModule.register({
        isGlobal: true,
        verifyAccessToken,
        credentialAuthenticator: ApiCredentialAuthenticatorService,
    }),
]

/** Shares the verifier instance with consumers of the Supabase token. */
export const authenticationProviders = (verifyAccessToken: VerifySupabaseAccessToken): Array<Provider> => [
    { provide: SUPABASE_ACCESS_TOKEN_VERIFIER, useValue: verifyAccessToken },
]
