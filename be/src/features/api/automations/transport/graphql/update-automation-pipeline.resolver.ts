import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { UpdatePipelineCommand } from "../../application/update-pipeline.command"
import { toAutomationCardType } from "./automation-card.mapper"
import { AutomationCardType } from "./dto/automation-card.type"
import { UpdateAutomationPipelineInput } from "./dto/update-automation-pipeline.input"
import { toUpdatePipelineRequest } from "./update-automation-pipeline.mapper"

@Resolver()
/** GraphQL door of the change of one pipeline. */
export class UpdateAutomationPipelineResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Changes one pipeline: switch, settings, wording, hide, send by itself; answers the card as it stands afterwards. */
    @Mutation(() => AutomationCardType, { name: "updateAutomationPipeline" })
    async updateAutomationPipeline(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: UpdateAutomationPipelineInput,
    ): Promise<AutomationCardType> {
        const result = await this.commandBus.execute(
            new UpdatePipelineCommand({ request: toUpdatePipelineRequest(workspaceId, input), principal }),
        )
        return toAutomationCardType(result)
    }
}
