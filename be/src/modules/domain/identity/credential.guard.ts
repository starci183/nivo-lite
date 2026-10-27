import { GqlExecutionContext } from "@nestjs/graphql"
import { Injectable } from "@nestjs/common"
import type { CanActivate, ExecutionContext } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import { InjectReflector } from "@modules/platform/composition"
import { requestOf } from "@modules/platform/http-security"
import type { CredentialArgumentsInput, CredentialAuthenticator, CredentialMetadata } from "./credential.contracts"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import { CREDENTIAL_KEY, InjectCredentialAuthenticator } from "./identity.decorators"

@Injectable()
/** Authenticates marked doors as the third global guard; unmarked doors pass untouched. */
export class CredentialGuard implements CanActivate {
    constructor(
        @InjectReflector() private readonly reflector: Reflector,
        @InjectCredentialAuthenticator() private readonly authenticator: CredentialAuthenticator,
    ) {}

    /** A credential door must authenticate its own credential, even when a session is also present. */
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const metadata = this.reflector.getAllAndOverride<CredentialMetadata | undefined>(CREDENTIAL_KEY, [
            context.getHandler(),
            context.getClass(),
        ])
        if (metadata === undefined) return true
        const request = requestOf(context)
        request.credentialPrincipal = undefined
        let authorization = request.headers.authorization ?? ""
        let resourceId = typeof request.params?.id === "string" ? request.params.id : undefined
        if (metadata.kind === "link-token") {
            authorization = GqlExecutionContext.create(context).getArgs<CredentialArgumentsInput>().input?.token ?? ""
        } else if (metadata.kind === "posting") {
            const input = GqlExecutionContext.create(context).getArgs<CredentialArgumentsInput>().input
            authorization = typeof input?.ws === "string" ? input.ws : ""
            resourceId = typeof input?.job === "string" ? input.job : ""
        }
        const principal = await this.authenticator.authenticate(metadata, authorization, resourceId)
        if (principal.kind !== metadata.kind || !principal.subject || !principal.workspaceId) {
            throw new IdentityError({ code: IdentityErrorCode.Unauthenticated })
        }
        request.credentialPrincipal = principal
        return true
    }
}
