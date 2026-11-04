import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptTemplateUpdateCommand } from "../../application/accept-template-update.command"
import { UpdateOfferType } from "./dto/update-offer.type"
import { AcceptTemplateUpdateInput } from "./dto/accept-template-update.input"
import { toAcceptTemplateUpdateRequest, toAcceptTemplateUpdateType } from "./accept-template-update.mapper"

@Resolver()
/** GraphQL door of acceptTemplateUpdate. */
export class AcceptTemplateUpdateResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Takes the named branches of a newer version into the agent, keeping every edit of the buyer on the others. */
    @Mutation(() => UpdateOfferType, { name: "acceptTemplateUpdate", nullable: true })
    async acceptTemplateUpdate(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AcceptTemplateUpdateInput,
    ): Promise<UpdateOfferType | null> {
        const result = await this.commandBus.execute(
            new AcceptTemplateUpdateCommand({ request: toAcceptTemplateUpdateRequest(workspaceId, input), principal }),
        )
        return toAcceptTemplateUpdateType(result)
    }
}
