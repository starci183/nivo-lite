import {
    AUTH_DOORS_SERVICE,
    AUTH_PASSWORDS,
    AUTH_PRINCIPAL_VERIFIER,
    AUTH_SESSIONS,
    AUTH_SIGN_IN_BUDGET,
} from "@starci/auth/server"

/** Token of the session store the identity domain implements over the package's tables. */
export const PASSPORT_SESSION_STORE: unique symbol = Symbol("integrations.passport.session-store")
/** Token of the account directory the identity domain implements over the user table. */
export const PASSPORT_ACCOUNTS: unique symbol = Symbol("integrations.passport.accounts")
/** Token of the rate counter the identity domain implements over its attempts table. */
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
