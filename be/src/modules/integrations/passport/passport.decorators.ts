import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { GoogleStateClient } from "./google-state.client"
import type { PassportAuthenticator } from "./passport.contracts"
import type { PasswordsOptions, PassportOptions } from "./passport.options"
import type { PassportFlowsService } from "./passport-flows.service"
import type { PassportPasswordsClient } from "./passport.password"
import type { PassportTokensClient } from "./passport.tokens"

/** Token of the options of the passport integration, exported so a spec can provide it. */
export const PASSPORT_OPTIONS: unique symbol = Symbol("integrations.passport.options")
/** Token of the options of the password hasher. */
export const PASSPORT_PASSWORDS_OPTIONS: unique symbol = Symbol("integrations.passport.passwords-options")
/** Token of the access-token signer and verifier. */
export const PASSPORT_TOKENS: unique symbol = Symbol("integrations.passport.tokens")
/** Token of the password hasher. */
export const PASSPORT_PASSWORDS: unique symbol = Symbol("integrations.passport.passwords")
/** Token of the strategy flows (local and Google legs). */
export const PASSPORT_FLOWS: unique symbol = Symbol("integrations.passport.flows")
/** Token of the Google round-trip state store. */
export const PASSPORT_GOOGLE_STATE: unique symbol = Symbol("integrations.passport.google-state")
/** Token of the app sign-in decisions. */
export const PASSPORT_AUTHENTICATOR: unique symbol = Symbol("integrations.passport.authenticator")

/** Injects the options. Parameter type: PassportOptions. */
export const InjectPassportOptions = (): TypedParameterDecorator<PassportOptions> =>
    injector<PassportOptions>(PASSPORT_OPTIONS)

/** Injects the token client. Parameter type: PassportTokensClient. */
export const InjectPassportTokens = (): TypedParameterDecorator<PassportTokensClient> =>
    injector<PassportTokensClient>(PASSPORT_TOKENS)

/** Injects the password hasher. Parameter type: PassportPasswordsClient. */
export const InjectPassportPasswords = (): TypedParameterDecorator<PassportPasswordsClient> =>
    injector<PassportPasswordsClient>(PASSPORT_PASSWORDS)

/** Injects the strategy flows. Parameter type: PassportFlowsService. */
export const InjectPassportFlows = (): TypedParameterDecorator<PassportFlowsService> =>
    injector<PassportFlowsService>(PASSPORT_FLOWS)

/** Injects the app authenticator. Parameter type: PassportAuthenticator. */
export const InjectPassportAuthenticator = (): TypedParameterDecorator<PassportAuthenticator> =>
    injector<PassportAuthenticator>(PASSPORT_AUTHENTICATOR)

/** Injects the password hasher options. Parameter type: PasswordsOptions. */
export const InjectPasswordsOptions = (): TypedParameterDecorator<PasswordsOptions> =>
    injector<PasswordsOptions>(PASSPORT_PASSWORDS_OPTIONS)

/** Injects the Google state store. Parameter type: GoogleStateClient. */
export const InjectGoogleState = (): TypedParameterDecorator<GoogleStateClient> =>
    injector<GoogleStateClient>(PASSPORT_GOOGLE_STATE)
