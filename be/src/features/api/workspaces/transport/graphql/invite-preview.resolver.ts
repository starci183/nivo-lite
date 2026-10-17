import type { CredentialPrincipal } from "@modules/domain/identity"
import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { Credential, CurrentCredentialPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { PreviewInviteQuery } from "../../application/preview-invite.query"
import { InvitePreviewType } from "./dto/invite-preview.type"
import { InviteTokenInput } from "./dto/invite-token.input"
import { toInvitePreviewType, toPreviewInviteRequest } from "./invite-preview.mapper"

@Resolver()
/** GraphQL door of an invitation link, open to a visitor who has not signed in yet. */
export class InvitePreviewResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Shows what the invitation offers before it is accepted; reveals nothing but what the link holder needs. */
    @Credential({ kind: "link-token", workflow: "preview-invite" })
    @RateLimit(RateTier.Strict)
    @Query(() => InvitePreviewType, { name: "invitePreview" })
    async invitePreview(
        @Args("input") input: InviteTokenInput,
        @CurrentCredentialPrincipal() credentialPrincipal: CredentialPrincipal,
    ): Promise<InvitePreviewType> {
        const result = await this.queryBus.execute(
            new PreviewInviteQuery({ request: { ...toPreviewInviteRequest(input), credentialPrincipal } }),
        )
        return toInvitePreviewType(result)
    }
}
