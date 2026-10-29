import { Module } from "@nestjs/common"
import type { DynamicModule, Provider } from "@nestjs/common"
import {
    PASSPORT_AUTHENTICATOR,
    PASSPORT_FLOWS,
    PASSPORT_GOOGLE_STATE,
    PASSPORT_PASSWORDS,
    PASSPORT_PASSWORDS_OPTIONS,
    PASSPORT_TOKENS,
} from "./passport.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./passport.module-definition"
import { GoogleStateClient } from "./google-state.client"
import { PassportFlowsService } from "./passport-flows.service"
import { PassportGoogleStrategy } from "./passport-google.adapter"
import { PassportLocalStrategy } from "./passport-local.adapter"
import { PassportPasswordsClient } from "./passport-passwords.client"
import { PassportTokensClient } from "./passport-tokens.client"

@Module({})
/** The passport integration: the local and Google strategies, our access-token signer, the password hasher and the flows that run them. */
export class PassportModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that signs people in. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const strategies: Array<Provider> =
            options.google === null ? [PassportLocalStrategy] : [PassportLocalStrategy, PassportGoogleStrategy]
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: PASSPORT_AUTHENTICATOR, useExisting: options.authenticator },
                { provide: PASSPORT_TOKENS, useClass: PassportTokensClient },
                { provide: PASSPORT_PASSWORDS_OPTIONS, useValue: { bcryptCost: options.bcryptCost } },
                { provide: PASSPORT_PASSWORDS, useClass: PassportPasswordsClient },
                { provide: PASSPORT_FLOWS, useClass: PassportFlowsService },
                { provide: PASSPORT_GOOGLE_STATE, useClass: GoogleStateClient },
                ...strategies,
            ],
            exports: [PASSPORT_TOKENS, PASSPORT_PASSWORDS, PASSPORT_FLOWS],
        }
    }
}
