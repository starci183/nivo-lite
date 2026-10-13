import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { DecideExecutionCommand } from "../../application/decide-execution.command"
import { ApprovalExecutionType } from "./dto/approval-execution.type"
import { DecideExecutionInput } from "./dto/decide-execution.input"
import { toApprovalExecutionType, toDecideExecutionRequest } from "./decisions.mapper"

@Resolver()
/** GraphQL door of the decision on a follow-up approval card. */
export class DecideExecutionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Approves (optionally with an edited draft) or rejects an approval card. */
    @Mutation(() => ApprovalExecutionType, { name: "decideExecution" })
    async decideExecution(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: DecideExecutionInput,
    ): Promise<ApprovalExecutionType> {
        const result = await this.commandBus.execute(
            new DecideExecutionCommand({ request: toDecideExecutionRequest(workspaceId, input, locale), principal }),
        )
        return toApprovalExecutionType(result)
    }
}
