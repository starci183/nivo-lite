import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetConnectionFirstEventQuery } from "../../application/get-connection-first-event.query"
import { GetConnectionFirstEventInput } from "./dto/get-connection-first-event.input"
import { FirstEventStateType } from "./dto/first-event-state.type"
import { toGetConnectionFirstEventRequest, toGetConnectionFirstEventType } from "./get-connection-first-event.mapper"

@Resolver()
/** GraphQL door of connectionFirstEvent. */
export class GetConnectionFirstEventResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Asks whether the first event of a connection has arrived. */
    @Query(() => FirstEventStateType, { name: "connectionFirstEvent" })
    async connectionFirstEvent(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: GetConnectionFirstEventInput,
    ): Promise<FirstEventStateType> {
        const result = await this.queryBus.execute(
            new GetConnectionFirstEventQuery({
                request: toGetConnectionFirstEventRequest(workspaceId, input),
                principal,
            }),
        )
        return toGetConnectionFirstEventType(result)
    }
}
