import type { CommandBus } from "@nestjs/cqrs"
import { Args, Int, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { KeepCurrentBrainFactCommand } from "../../application/keep-current-brain-fact.command"
import { KeepCurrentBrainFactInput } from "./dto/keep-current-brain-fact.input"
import { toKeepCurrentBrainFactRequest } from "./keep-current-brain-fact.mapper"

@Resolver()
/** GraphQL door of keeps the value in force and rejects every waiting value of its key. */
export class KeepCurrentBrainFactResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Keeps the value in force and rejects every waiting value of its key. */
    @Mutation(() => Int, { name: "keepCurrentBrainFact" })
    async keepCurrentBrainFact(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: KeepCurrentBrainFactInput,
    ): Promise<number> {
        const result = await this.commandBus.execute(
            new KeepCurrentBrainFactCommand({ request: toKeepCurrentBrainFactRequest(workspaceId, input), principal }),
        )
        return result
    }
}
