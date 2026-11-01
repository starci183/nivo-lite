import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ApplyBrainFactGroupCommand } from "../../application/apply-brain-fact-group.command"
import { ApplyBrainFactGroupInput } from "./dto/apply-brain-fact-group.input"
import { BrainBulkAppliedType } from "./dto/brain-bulk-applied.type"
import { toApplyBrainFactGroupRequest, toBrainBulkAppliedType } from "./apply-brain-fact-group.mapper"

@Resolver()
/** GraphQL door of applying the checked facts of one internal document together. */
export class ApplyBrainFactGroupResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Applies the checked facts of one internal document together, as one batch that can be taken back. */
    @Mutation(() => BrainBulkAppliedType, { name: "applyBrainFactGroup" })
    async applyBrainFactGroup(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ApplyBrainFactGroupInput,
    ): Promise<BrainBulkAppliedType> {
        const result = await this.commandBus.execute(
            new ApplyBrainFactGroupCommand({ request: toApplyBrainFactGroupRequest(workspaceId, input), principal }),
        )
        return toBrainBulkAppliedType(result)
    }
}
