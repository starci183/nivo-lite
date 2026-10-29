import type { DynamicModule } from "@nestjs/common"
import {
    IDENTITY_AUTHENTICATOR,
    IDENTITY_ERROR_KINDS,
    IDENTITY_MESSAGES,
    IdentityModule,
} from "@modules/domain/identity"
import { ApiCredentialAuthenticatorService, ApiCredentialsModule } from "@modules/domain/api-credentials"
import {
    PASSPORT_ERROR_KINDS,
    PASSPORT_MESSAGES,
    PASSPORT_TOKENS,
    PassportModule,
} from "@modules/integrations/passport"
import type { ApiOptions } from "../api.options"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"

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

/** The error kinds of the capabilities this group registers, in registration order. */
export const authenticationErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    IDENTITY_ERROR_KINDS,
    PASSPORT_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const authenticationMessages: ReadonlyArray<MessageBundle> = [IDENTITY_MESSAGES, PASSPORT_MESSAGES]
