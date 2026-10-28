import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListZaloEventsQuery } from "../../application/list-zalo-events.query"
import { ListZaloEventsInput } from "./dto/list-zalo-events.input"
import { ZaloEventType } from "./dto/zalo-event.type"
import { toListZaloEventsRequest, toListZaloEventsType } from "./list-zalo-events.mapper"

@Resolver()
/** GraphQL door of zaloConnectionEvents. */
export class ListZaloEventsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Asks for the live events of a Zalo OA connection. */
    @Query(() => [ZaloEventType], { name: "zaloConnectionEvents" })
    async zaloConnectionEvents(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ListZaloEventsInput,
    ): Promise<Array<ZaloEventType>> {
        const result = await this.queryBus.execute(
            new ListZaloEventsQuery({ request: toListZaloEventsRequest(workspaceId, input), principal }),
        )
        return toListZaloEventsType(result)
    }
}
