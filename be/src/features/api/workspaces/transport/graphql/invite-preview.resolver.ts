import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { Public, PublicReason } from "@modules/domain/identity"
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
    @Public({ reason: PublicReason.InviteLink })
    @RateLimit(RateTier.Strict)
    @Query(() => InvitePreviewType, { name: "invitePreview" })
    async invitePreview(@Args("input") input: InviteTokenInput): Promise<InvitePreviewType> {
        const result = await this.queryBus.execute(new PreviewInviteQuery({ request: toPreviewInviteRequest(input) }))
        return toInvitePreviewType(result)
    }
}
