import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetInboundSimulationStatusQuery } from "../../application/get-inbound-simulation-status.query"
import { toInboundSimulationStatusRequest, toInboundSimulationStatusType } from "./get-inbound-simulation-status.mapper"
import { InboundSimulationStatusInput } from "./dto/inbound-simulation-status.input"
import { InboundSimulationStatusType } from "./dto/inbound-simulation-status.type"

@Resolver()
/** The GraphQL polling door of the Inbox simulator. */
export class InboundSimulationStatusResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads a simulated input's queued, running or terminal state and department result. */
    @Query(() => InboundSimulationStatusType, { name: "inboundSimulationStatus" })
    async inboundSimulationStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: InboundSimulationStatusInput,
    ): Promise<InboundSimulationStatusType> {
        const result = await this.queryBus.execute(
            new GetInboundSimulationStatusQuery({
                request: toInboundSimulationStatusRequest(workspaceId, input),
                principal,
            }),
        )
        return toInboundSimulationStatusType(result)
    }
}
