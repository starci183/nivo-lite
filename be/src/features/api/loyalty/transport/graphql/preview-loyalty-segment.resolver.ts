import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { PreviewSegmentCommand } from "../../application/preview-segment.command"
import { toPreviewLoyaltySegmentRequest, toPreviewLoyaltySegmentType } from "./preview-loyalty-segment.mapper"
import { PreviewLoyaltySegmentInput } from "./dto/preview-loyalty-segment.input"
import { PreviewLoyaltySegmentType } from "./dto/preview-loyalty-segment.type"

@Resolver()
/** The GraphQL door for preview loyalty segment. */
export class PreviewLoyaltySegmentResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs preview loyalty segment for the selected workspace. */
    @Mutation(() => PreviewLoyaltySegmentType, { name: "previewLoyaltySegment" })
    async previewLoyaltySegment(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: PreviewLoyaltySegmentInput,
    ): Promise<PreviewLoyaltySegmentType> {
        const result = await this.commandBus.execute(
            new PreviewSegmentCommand({ request: toPreviewLoyaltySegmentRequest(input, workspaceId), principal }),
        )
        return toPreviewLoyaltySegmentType(result)
    }
}
