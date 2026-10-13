import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListInboundEventsQuery } from "../../application/list-inbound-events.query"
import { InboundEventsInput } from "./dto/inbound-events.input"
import { InboundEventType } from "./dto/inbound-event.type"
import { toInboundEventsRequest, toInboundEventsType } from "./inbound-events.mapper"

@Resolver()
/** GraphQL door for the selected workspace's recent inbound events. */
export class InboundEventsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the latest inputs, newest first, after proving active membership. */
    @Query(() => [InboundEventType], { name: "inboundEvents" })
    async inboundEvents(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: InboundEventsInput,
    ): Promise<Array<InboundEventType>> {
        const result = await this.queryBus.execute(
            new ListInboundEventsQuery({ request: toInboundEventsRequest(workspaceId, input), principal }),
        )
        return toInboundEventsType(result)
    }
}
