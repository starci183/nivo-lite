import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { LeadFlowQuery } from "../../application/lead-flow.query"
import { LeadFlowInput } from "./dto/lead-flow.input"
import { LeadFlowType } from "./dto/lead-flow.type"
import { toLeadFlowRequest, toLeadFlowType } from "./lead-flow.mapper"

@Resolver()
/** GraphQL door of the selected customer's journey. */
export class LeadFlowResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads work, orders, invoices, payments and decisions for the customer. */
    @Query(() => LeadFlowType, { name: "leadFlow" })
    async leadFlow(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: LeadFlowInput,
    ): Promise<LeadFlowType> {
        const result = await this.queryBus.execute(
            new LeadFlowQuery({ request: toLeadFlowRequest(input, workspaceId), principal }),
        )
        return toLeadFlowType(result)
    }
}
