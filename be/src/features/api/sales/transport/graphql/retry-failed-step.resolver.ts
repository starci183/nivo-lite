import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { RetryFailedStepCommand } from "../../application/retry-failed-step.command"
import { toRetryFailedStepRequest, toRetryFailedStepType } from "./retry-failed-step.mapper"
import { RetryFailedStepInput } from "./dto/retry-failed-step.input"
import { SalesActionType } from "./dto/sales-action.type"

@Resolver()
/** The GraphQL door of retryFailedStep. */
export class RetryFailedStepResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Queues a retry of one failed Sales step. */
    @Mutation(() => SalesActionType, { name: "retryFailedStep" })
    async retryFailedStep(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: RetryFailedStepInput,
    ): Promise<SalesActionType> {
        const result = await this.commandBus.execute(
            new RetryFailedStepCommand({ request: toRetryFailedStepRequest(workspaceId, locale, input), principal }),
        )
        return toRetryFailedStepType(result)
    }
}
