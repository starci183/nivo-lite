export { AuthError, digestOf, isAcceptablePassword, isPresentablePassword, normalizeEmail } from "@starci/auth/server"
export type {
    AccountDirectory,
    AccountStanding,
    AuthAuthenticator,
    AuthDoors,
    AuthPasswords,
    AuthSessions,
    AuthSubject,
    GoogleProfile,
    HttpExchange,
    NewSession,
    PrincipalVerifier,
    RefreshTokenRecord,
    SessionStore,
    SessionTransaction,
    SignInBudget,
} from "@starci/auth/server"
export { AUTH_ERROR_CODES } from "@starci/auth/contracts"
export type { AccessGrant, GoogleRedirect, JwksDocument } from "@starci/auth/contracts"
export { PASSPORT_MESSAGES } from "./messages/passport.messages"
export { parsePassportConfig } from "./passport.config"
export {
    InjectAuthDoors,
    InjectAuthPasswords,
    InjectAuthSessions,
    InjectSignInBudget,
    PASSPORT_ACCOUNTS,
    PASSPORT_DOORS,
    PASSPORT_PASSWORDS,
    PASSPORT_PRINCIPAL_VERIFIER,
    PASSPORT_RATE_COUNTER,
    PASSPORT_SESSION_STORE,
    PASSPORT_SESSIONS,
    PASSPORT_SIGN_IN_BUDGET,
} from "./passport.decorators"
export { PASSPORT_ERROR_KINDS, PassportError, PassportErrorCode } from "./errors/passport.error"
export { PassportModule } from "./passport.module"
