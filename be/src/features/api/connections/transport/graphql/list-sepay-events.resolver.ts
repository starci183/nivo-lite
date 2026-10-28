import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListSepayEventsQuery } from "../../application/list-sepay-events.query"
import { ListSepayEventsInput } from "./dto/list-sepay-events.input"
import { SepayWebhookEventType } from "./dto/sepay-webhook-event.type"
import { toListSepayEventsRequest, toListSepayEventsType } from "./list-sepay-events.mapper"

@Resolver()
/** GraphQL door of sepayConnectionEvents. */
export class ListSepayEventsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Asks for the newest webhook deliveries of one SePay connection. */
    @Query(() => [SepayWebhookEventType], { name: "sepayConnectionEvents" })
    async sepayConnectionEvents(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ListSepayEventsInput,
    ): Promise<Array<SepayWebhookEventType>> {
        const result = await this.queryBus.execute(
            new ListSepayEventsQuery({ request: toListSepayEventsRequest(workspaceId, input), principal }),
        )
        return toListSepayEventsType(result)
    }
}
