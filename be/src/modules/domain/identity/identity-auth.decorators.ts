import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { IdentityAuthOptions } from "./identity-auth.options"

/** Token of the sign-in options of identity. */
export const IDENTITY_AUTH_OPTIONS: unique symbol = Symbol("domain.identity.auth-options")

/** Token of the sign-in decisions (the passport authenticator). */
export const IDENTITY_AUTHENTICATOR: unique symbol = Symbol("domain.identity.authenticator")

/** Token of the account directory, avatar store and invitation delivery that identity provides. */
export const IDENTITY_ACCOUNTS: unique symbol = Symbol("domain.identity.accounts")

/** Injects the sign-in options. Parameter type: IdentityAuthOptions. */
export const InjectIdentityAuthOptions = (): TypedParameterDecorator<IdentityAuthOptions> =>
    injector<IdentityAuthOptions>(IDENTITY_AUTH_OPTIONS)
