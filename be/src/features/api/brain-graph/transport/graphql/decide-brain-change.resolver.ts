import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DecideBrainChangeCommand } from "../../application/decide-brain-change.command"
import { BrainChangeDecisionType } from "./dto/brain-change-decision.type"
import { DecideBrainChangeInput } from "./dto/decide-brain-change.input"
import { toBrainChangeDecisionType, toDecideBrainChangeRequest } from "./brain-graph.mapper"

@Resolver()
/** GraphQL door of Đồng ý / Không on a truth-graph change card. */
export class DecideBrainChangeResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Approves (the workspace owner only) or turns down the change request of a card; the card is rewritten in place. */
    @Mutation(() => BrainChangeDecisionType, { name: "decideBrainChange" })
    async decideBrainChange(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DecideBrainChangeInput,
    ): Promise<BrainChangeDecisionType> {
        const result = await this.commandBus.execute(
            new DecideBrainChangeCommand({ request: toDecideBrainChangeRequest(workspaceId, input), principal }),
        )
        return toBrainChangeDecisionType(result)
    }
}
