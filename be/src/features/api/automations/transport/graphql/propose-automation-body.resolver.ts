import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ProposeBodyCommand } from "../../application/propose-body.command"
import { BodyProposalType } from "./dto/body-proposal.type"
import { TemplateKeyInput } from "./dto/template-key.input"
import { toBodyProposalType, toTemplateRequest } from "./template-key.mapper"

@Resolver()
/** GraphQL door of the shop's own wording of a template. */
export class ProposeAutomationBodyResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Proposes the shop's own wording of a template. */
    @Mutation(() => BodyProposalType, { name: "proposeAutomationBody" })
    async proposeAutomationBody(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: TemplateKeyInput,
    ): Promise<BodyProposalType> {
        const result = await this.commandBus.execute(
            new ProposeBodyCommand({ request: toTemplateRequest(workspaceId, input), principal }),
        )
        return toBodyProposalType(result)
    }
}
