export { AuthGuard } from "./auth.guard"
export { refuseSessions } from "./access-token.policy"
export { IDENTITY_ERROR_KINDS, IdentityError, IdentityErrorCode } from "./errors/identity.error"
export { IDENTITY_MESSAGES } from "./messages/identity.messages"
export { PublicReason } from "./identity.contracts"
export type { VerifyAccessToken } from "./identity.contracts"
export { CurrentCredentialPrincipal, Credential, CurrentPrincipal, Public } from "./identity.decorators"
export { IdentityModule } from "./identity.module"
export { isAcceptablePassword, normalizeEmail } from "./password.policy"
export { parseIdentityAuthConfig } from "./identity-auth.config"
export type { AccessGrant, GoogleRedirect } from "./identity-auth.contracts"
export { IDENTITY_ACCOUNTS, IDENTITY_AUTHENTICATOR } from "./identity-auth.decorators"
export { IdentityPasswordResetService } from "./password-reset.service"
export { IdentitySessionsService } from "./sessions.service"
export { IdentitySignInService } from "./sign-in.service"
export { IdentitySignupService } from "./signup.service"
export type {
    CredentialAuthenticator,
    CredentialMetadata,
    CredentialPrincipal,
    CredentialResourceId,
} from "./credential.contracts"
export { CredentialGuard } from "./credential.guard"
export { identityEntities } from "./persistence/entities"
