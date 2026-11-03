import { Module } from "@nestjs/common"
import type { DynamicModule, Provider } from "@nestjs/common"
import {
    PASSPORT_ACCOUNTS,
    PASSPORT_PRINCIPAL_VERIFIER,
    PASSPORT_RATE_COUNTER,
    PASSPORT_SESSION_STORE,
} from "@modules/integrations/passport"
import { CLOCK } from "@modules/platform/clock"
import { RATE_LIMIT_STORE } from "@modules/platform/database"
import { IdentityAccountsService } from "./accounts.service"
import { IdentityAccountDirectoryService } from "./identity-account-directory.service"
import { createAccessTokenVerifier, refuseSessions } from "./access-token.policy"
import { AuthGuard } from "./auth.guard"
import { IdentityAuthenticatorService } from "./authenticator.service"
import { CredentialGuard } from "./credential.guard"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import { ACCESS_TOKEN_VERIFIER, CREDENTIAL_AUTHENTICATOR } from "./identity.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./identity.module-definition"
import { IDENTITY_ACCOUNTS, IDENTITY_AUTHENTICATOR, IDENTITY_AUTH_OPTIONS } from "./identity-auth.decorators"
import type { IdentityAuthOptions } from "./identity-auth.options"
import { IdentityPasswordResetService } from "./password-reset.service"
import { IdentitySessionStoreService } from "./identity-session-store.service"
import { IdentitySignInService } from "./sign-in.service"
import { IdentitySignupService } from "./signup.service"

const SIGN_IN_EXPORTS = [
    IDENTITY_AUTHENTICATOR,
    IDENTITY_ACCOUNTS,
    IdentityPasswordResetService,
    IdentitySignInService,
    IdentitySignupService,
    PASSPORT_SESSION_STORE,
    PASSPORT_ACCOUNTS,
    PASSPORT_RATE_COUNTER,
]

const signInProviders = (auth: IdentityAuthOptions): Array<Provider> => [
    { provide: IDENTITY_AUTH_OPTIONS, useValue: auth },
    IdentitySessionStoreService,
    IdentityAccountDirectoryService,
    { provide: PASSPORT_SESSION_STORE, useExisting: IdentitySessionStoreService },
    { provide: PASSPORT_ACCOUNTS, useExisting: IdentityAccountDirectoryService },
    { provide: PASSPORT_RATE_COUNTER, useExisting: RATE_LIMIT_STORE },
    IdentityAuthenticatorService,
    { provide: IDENTITY_AUTHENTICATOR, useExisting: IdentityAuthenticatorService },
    IdentityPasswordResetService,
    IdentityAccountsService,
    { provide: IDENTITY_ACCOUNTS, useExisting: IdentityAccountsService },
    IdentitySignInService,
    IdentitySignupService,
]

@Module({})
/**
 * The identity capability: its default-deny guard admits public doors, verified sessions and explicitly selected
 * credentials; with sign-in options it also holds the sessions, passwords and accounts behind them.
 */
export class IdentityModule extends ConfigurableModuleClass {
    /** Registers identity once per app with the verifier parsed at the composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                options.ownTokens !== true
                    ? { provide: ACCESS_TOKEN_VERIFIER, useValue: options.verifyAccessToken ?? refuseSessions }
                    : {
                          provide: ACCESS_TOKEN_VERIFIER,
                          useFactory: createAccessTokenVerifier,
                          inject: [PASSPORT_PRINCIPAL_VERIFIER, CLOCK],
                      },
                options.credentialAuthenticator === undefined
                    ? {
                          provide: CREDENTIAL_AUTHENTICATOR,
                          useValue: {
                              authenticate: () => {
                                  throw new IdentityError({ code: IdentityErrorCode.Unauthenticated })
                              },
                          },
                      }
                    : { provide: CREDENTIAL_AUTHENTICATOR, useClass: options.credentialAuthenticator },
                CredentialGuard,
                AuthGuard,
                ...(options.auth === undefined ? [] : signInProviders(options.auth)),
            ],
            exports: [
                AuthGuard,
                ACCESS_TOKEN_VERIFIER,
                CredentialGuard,
                CREDENTIAL_AUTHENTICATOR,
                ...(options.auth === undefined ? [] : SIGN_IN_EXPORTS),
            ],
        }
    }
}
