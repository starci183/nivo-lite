import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ShiftsWorkbenchQuery } from "../../application/shifts-workbench.query"
import { ShiftsBenchType } from "./dto/shifts-bench.type"
import { toShiftsWorkbenchRequest, toShiftsBenchType } from "./shifts-workbench.mapper"

@Resolver()
/** GraphQL door: the whole shifts workbench of the caller's workspace for one week. */
export class ShiftsWorkbenchResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The whole shifts workbench of the caller's workspace for one week. */
    @Query(() => ShiftsBenchType, { name: "shiftsWorkbench" })
    async shiftsWorkbench(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("week", { type: () => String, nullable: true }) week?: string,
    ): Promise<ShiftsBenchType> {
        const result = await this.queryBus.execute(
            new ShiftsWorkbenchQuery({ request: toShiftsWorkbenchRequest(workspaceId, week), principal }),
        )
        return toShiftsBenchType(result)
    }
}
