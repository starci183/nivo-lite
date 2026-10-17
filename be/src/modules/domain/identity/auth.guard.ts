import { Injectable } from "@nestjs/common"
import type { CanActivate, ExecutionContext } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import type { VerifySupabaseAccessToken } from "@modules/integrations/supabase"
import { InjectReflector } from "@modules/platform/composition"
import type { Principal } from "@modules/platform/cqrs"
import { requestOf } from "@modules/platform/http-security"
import { unwrapOutcome } from "@modules/platform/primitives"
import type { CredentialMetadata } from "./credential.contracts"
import { admit } from "./admission.policy"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"
import { CREDENTIAL_KEY, InjectAccessTokenVerifier, PUBLIC_KEY } from "./identity.decorators"

const bearerToken = (authorization: string | undefined): string | undefined => {
    const [scheme, token, extra] = authorization?.split(" ") ?? []
    return scheme?.toLowerCase() === "bearer" && token && extra === undefined ? token : undefined
}

@Injectable()
/**
 * The fourth app guard: doors require an established credential, a public reason or a verified session.
 */
export class AuthGuard implements CanActivate {
    constructor(
        @InjectReflector() private readonly reflector: Reflector,
        @InjectAccessTokenVerifier() private readonly verifyAccessToken: VerifySupabaseAccessToken,
    ) {}

    /** Enforces the selected admission proof before considering a public reason or verified user session. */
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const credential = this.reflector.getAllAndOverride<CredentialMetadata | undefined>(CREDENTIAL_KEY, [
            context.getHandler(),
            context.getClass(),
        ])
        if (credential !== undefined) {
            if (requestOf(context).credentialPrincipal === undefined) {
                throw new IdentityError({ code: IdentityErrorCode.Unauthenticated })
            }
            return true
        }
        const metadata = this.reflector.getAllAndOverride<PublicMetadata | undefined>(PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ])
        let principal: Principal | undefined
        if (metadata === undefined) {
            const request = requestOf(context)
            const token = bearerToken(request.headers.authorization)
            if (token !== undefined) {
                const verified = await this.verifyAccessToken(token)
                if (verified.kind === "ok") {
                    principal = verified.value
                    request.principal = verified.value
                }
            }
        }
        unwrapOutcome(admit(metadata, principal), IdentityError)
        return true
    }
}
