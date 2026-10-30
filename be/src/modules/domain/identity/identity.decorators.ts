import { SetMetadata, applyDecorators, createParamDecorator } from "@nestjs/common"
import type { ExecutionContext } from "@nestjs/common"
import { injector } from "@modules/platform/composition"
import type { DoorDecorator, TypedParameterDecorator } from "@modules/platform/composition"
import { ServerToServer, requestOf } from "@modules/platform/http-security"
import type { Principal } from "@modules/platform/cqrs"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import type { CredentialAuthenticator, CredentialMetadata, CredentialPrincipal } from "./credential.contracts"
import { PublicReason } from "./identity.contracts"
import type { PublicMetadata, VerifyAccessToken } from "./identity.contracts"

/** Token of the access-token verifier the composition root hands to identity. */
export const ACCESS_TOKEN_VERIFIER: unique symbol = Symbol("domain.identity.access-token-verifier")

/** Injects the access-token verifier identity was registered with. Parameter type: VerifyAccessToken. */
export const InjectAccessTokenVerifier = (): TypedParameterDecorator<VerifyAccessToken> =>
    injector<VerifyAccessToken>(ACCESS_TOKEN_VERIFIER)

/** Metadata key of `@Public`. */
export const PUBLIC_KEY = "domain.identity.public"

/**
 * Opens a door to anonymous callers, stating why; other doors require their selected credential or a verified session.
 * A signed webhook proves its caller by its signature, so it owes no browser origin.
 */
export const Public = (metadata: PublicMetadata): DoorDecorator =>
    metadata.reason === PublicReason.SignedWebhook
        ? applyDecorators(SetMetadata(PUBLIC_KEY, metadata), ServerToServer())
        : applyDecorators(SetMetadata(PUBLIC_KEY, metadata))

/** The authenticated caller established by the default-deny guard. */
export const CurrentPrincipal = createParamDecorator((_data: unknown, context: ExecutionContext): Principal => {
    const principal = requestOf(context).principal
    if (!principal) throw new IdentityError({ code: IdentityErrorCode.Unauthenticated })
    return principal
})

/** Metadata for a door authenticated by its own credential rather than a user session. */
export const CREDENTIAL_KEY: unique symbol = Symbol("domain.identity.credential")

/** The composition-owned verifier of alternate credentials. */
export const CREDENTIAL_AUTHENTICATOR: unique symbol = Symbol("domain.identity.credential-authenticator")

/** Injects the alternate-credential verifier. Parameter type: CredentialAuthenticator. */
export const InjectCredentialAuthenticator = (): TypedParameterDecorator<CredentialAuthenticator> =>
    injector<CredentialAuthenticator>(CREDENTIAL_AUTHENTICATOR)

/**
 * Requires successful credential authentication before the global default-deny gate. The credential travels in a header
 * no browser attaches by itself, so the door owes no browser origin.
 */
export const Credential = (metadata: CredentialMetadata): DoorDecorator =>
    applyDecorators(SetMetadata(CREDENTIAL_KEY, metadata), ServerToServer())

/** The stored link record established by the credential guard. */
export const CurrentCredentialPrincipal = createParamDecorator(
    (_data: unknown, context: ExecutionContext): CredentialPrincipal => {
        const principal = requestOf(context).credentialPrincipal
        if (!principal) throw new IdentityError({ code: IdentityErrorCode.Unauthenticated })
        return principal
    },
)
