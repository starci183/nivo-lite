import {
    AUTH_DOORS_SERVICE,
    AUTH_PASSWORDS,
    AUTH_PRINCIPAL_VERIFIER,
    AUTH_SESSIONS,
    AUTH_SIGN_IN_BUDGET,
} from "@starci/auth/server"
import type { AuthDoors, AuthPasswords, AuthSessions, SignInBudget } from "@starci/auth/server"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"

/** Token of the session store the identity domain implements over the package's tables. */
export const PASSPORT_SESSION_STORE: unique symbol = Symbol("integrations.passport.session-store")
/** Token of the account directory the identity domain implements over the user table. */
export const PASSPORT_ACCOUNTS: unique symbol = Symbol("integrations.passport.accounts")
/** Token of the rate counter the identity domain implements over the shared rate-limit store. */
export const PASSPORT_RATE_COUNTER: unique symbol = Symbol("integrations.passport.rate-counter")

/** Token of the verifier of the app's own access tokens. */
export const PASSPORT_PRINCIPAL_VERIFIER: typeof AUTH_PRINCIPAL_VERIFIER = AUTH_PRINCIPAL_VERIFIER
/** Token of the sign-in doors. */
export const PASSPORT_DOORS: typeof AUTH_DOORS_SERVICE = AUTH_DOORS_SERVICE
/** Token of the rotating sessions. */
export const PASSPORT_SESSIONS: typeof AUTH_SESSIONS = AUTH_SESSIONS
/** Token of the password hasher. */
export const PASSPORT_PASSWORDS: typeof AUTH_PASSWORDS = AUTH_PASSWORDS
/** Token of the failures-only sign-in budget. */
export const PASSPORT_SIGN_IN_BUDGET: typeof AUTH_SIGN_IN_BUDGET = AUTH_SIGN_IN_BUDGET

/** Injects the sign-in doors. Parameter type: AuthDoors. */
export const InjectAuthDoors = (): TypedParameterDecorator<AuthDoors> => injector<AuthDoors>(PASSPORT_DOORS)

/** Injects the rotating sessions. Parameter type: AuthSessions. */
export const InjectAuthSessions = (): TypedParameterDecorator<AuthSessions> => injector<AuthSessions>(PASSPORT_SESSIONS)

/** Injects the password hasher. Parameter type: AuthPasswords. */
export const InjectAuthPasswords = (): TypedParameterDecorator<AuthPasswords> =>
    injector<AuthPasswords>(PASSPORT_PASSWORDS)

/** Injects the failures-only sign-in budget. Parameter type: SignInBudget. */
export const InjectSignInBudget = (): TypedParameterDecorator<SignInBudget> =>
    injector<SignInBudget>(PASSPORT_SIGN_IN_BUDGET)
