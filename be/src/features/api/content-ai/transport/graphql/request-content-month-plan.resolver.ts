import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestContentMonthPlanCommand } from "../../application/request-content-month-plan.command"
import { toRequestContentMonthPlanRequest, toRequestContentMonthPlanType } from "./request-content-month-plan.mapper"
import { RequestContentMonthPlanInput } from "./dto/request-content-month-plan.input"
import { ContentAiRequestedType } from "./dto/content-ai-requested.type"

@Resolver()
/** GraphQL door to queued content work. */
export class RequestContentMonthPlanResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Returns immediately after the job is queued. */
    @Mutation(() => ContentAiRequestedType, { name: "requestContentMonthPlan" })
    async requestContentMonthPlan(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestContentMonthPlanInput,
    ): Promise<ContentAiRequestedType> {
        const result = await this.commandBus.execute(
            new RequestContentMonthPlanCommand({
                request: toRequestContentMonthPlanRequest(workspaceId, input),
                principal,
            }),
        )
        return toRequestContentMonthPlanType(result)
    }
}
