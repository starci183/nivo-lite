import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CredentialGuard } from "./credential.guard"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import { AuthGuard } from "./auth.guard"
import { ACCESS_TOKEN_VERIFIER, CREDENTIAL_AUTHENTICATOR } from "./identity.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./identity.module-definition"

@Module({})
/**
 * The identity capability: its default-deny guard admits public doors, verified sessions and explicitly selected
 * credentials.
 */
export class IdentityModule extends ConfigurableModuleClass {
    /** Registers identity once per app with the verifier parsed at the composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                {
                    provide: ACCESS_TOKEN_VERIFIER,
                    useValue: options.verifyAccessToken,
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
            ],
            exports: [AuthGuard, ACCESS_TOKEN_VERIFIER, CredentialGuard, CREDENTIAL_AUTHENTICATOR],
        }
    }
}
