import type { DynamicModule } from "@nestjs/common"
import { IdentityModule, IDENTITY_AUTHENTICATOR } from "@modules/domain/identity"
import { ApiCredentialAuthenticatorService, ApiCredentialsModule } from "@modules/domain/api-credentials"
import { PASSPORT_TOKENS, PassportModule } from "@modules/integrations/passport"
import type { ApiOptions } from "../api.options"

/** Registers authentication: our own sign-in (passport strategies, tokens, sessions) and the guard that verifies its access tokens. */
export const authenticationModules = (options: ApiOptions): Array<DynamicModule> => [
    PassportModule.register({ isGlobal: true, ...options.passport, authenticator: IDENTITY_AUTHENTICATOR }),
    ApiCredentialsModule.register({ isGlobal: true }),
    IdentityModule.register({
        isGlobal: true,
        tokens: PASSPORT_TOKENS,
        auth: options.identityAuth,
        credentialAuthenticator: ApiCredentialAuthenticatorService,
    }),
]
