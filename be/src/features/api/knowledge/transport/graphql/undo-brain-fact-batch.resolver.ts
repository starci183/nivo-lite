import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { UndoBrainFactBatchCommand } from "../../application/undo-brain-fact-batch.command"
import { BrainBulkUndoneType } from "./dto/brain-bulk-undone.type"
import { UndoBrainFactBatchInput } from "./dto/undo-brain-fact-batch.input"
import { toBrainBulkUndoneType, toUndoBrainFactBatchRequest } from "./undo-brain-fact-batch.mapper"

@Resolver()
/** GraphQL door of taking a batch of facts applied together back to review. */
export class UndoBrainFactBatchResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Takes a batch of facts applied together back to review. */
    @Mutation(() => BrainBulkUndoneType, { name: "undoBrainFactBatch" })
    async undoBrainFactBatch(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: UndoBrainFactBatchInput,
    ): Promise<BrainBulkUndoneType> {
        const result = await this.commandBus.execute(
            new UndoBrainFactBatchCommand({ request: toUndoBrainFactBatchRequest(workspaceId, input), principal }),
        )
        return toBrainBulkUndoneType(result)
    }
}
