import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { ReadScheduledItemsQuery } from "../../application/read-scheduled-items.query"
import { RunScheduledItemNowCommand } from "../../application/run-scheduled-item-now.command"
import { RunScheduledItemNowInput } from "./dto/run-scheduled-item-now.input"
import { RunScheduledItemNowType } from "./dto/run-scheduled-item-now.type"
import { ScheduledItemType } from "./dto/scheduled-item.type"

@Resolver()
/** GraphQL door of the agents' schedule: what is scheduled in the workspace, and "run now" for one item. */
export class ScheduledItemsResolver {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** What the agents of the workspace have scheduled (care timers, tasks, clock slots, stop deadlines), soonest first. Owner or manager. */
    @Query(() => [ScheduledItemType], { name: "scheduledItems" })
    scheduledItems(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<ReadonlyArray<ScheduledItemType>> {
        return this.queryBus.execute(new ReadScheduledItemsQuery({ request: { workspaceId }, principal }))
    }

    /** Runs one scheduled item now: its own job moves to now (never a second one); the press is recorded. Owner or manager. */
    @Mutation(() => RunScheduledItemNowType, { name: "runScheduledItemNow" })
    async runScheduledItemNow(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RunScheduledItemNowInput,
    ): Promise<RunScheduledItemNowType> {
        return this.commandBus.execute(
            new RunScheduledItemNowCommand({ request: { workspaceId, id: input.id }, principal }),
        )
    }
}
