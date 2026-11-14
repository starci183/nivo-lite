import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { RunStopsQuery } from "../../application/run-stops.query"
import { toRunStopsRequest } from "./run-stops.mapper"
import { RunStopsInput } from "./dto/run-stops.input"
import { RunStopsPageType } from "./dto/run-stops.type"

@Resolver()
/** GraphQL door of runStops. */
export class RunStopsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The open stops of the workspace, newest first, with what answering each needs (owner or manager). */
    @Query(() => RunStopsPageType, { name: "runStops" })
    runStops(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input", { type: () => RunStopsInput, nullable: true }) input: RunStopsInput | null,
    ): Promise<RunStopsPageType> {
        return this.queryBus.execute(new RunStopsQuery({ request: toRunStopsRequest(workspaceId, input), principal }))
    }
}
