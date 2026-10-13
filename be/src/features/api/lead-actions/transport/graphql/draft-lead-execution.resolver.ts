import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import { DraftLeadExecutionCommand } from "../../application/draft-lead-execution.command"
import { DraftLeadExecutionInput } from "./dto/draft-lead-execution.input"
import { LeadActionQueuedType } from "./dto/lead-action-queued.type"
import { toDraftLeadExecutionRequest, toDraftLeadExecutionType } from "./draft-lead-execution.mapper"

@Resolver()
/** GraphQL door for the queued draft-execution lead operation. */
export class DraftLeadExecutionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Queues a draft execution plan for the lead. */
    @Mutation(() => LeadActionQueuedType, { name: "draftLeadExecution" })
    async draftLeadExecution(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DraftLeadExecutionInput,
        @AcceptedLocale() acceptLanguage: string,
    ): Promise<LeadActionQueuedType> {
        const result = await this.commandBus.execute(
            new DraftLeadExecutionCommand({
                request: toDraftLeadExecutionRequest(workspaceId, input, acceptLanguage),
                principal,
            }),
        )
        return toDraftLeadExecutionType(result)
    }
}
