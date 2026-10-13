import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListStaffQuery } from "../../application/list-staff.query"
import { StaffOptionType } from "./dto/staff-option.type"
import { toStaffOptionsType } from "./workspace-staff.mapper"

@Resolver()
/** GraphQL door of the linkable staff of the caller's workspace. */
export class WorkspaceStaffResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the active staff of the caller's workspace a member can be linked to. */
    @Query(() => [StaffOptionType], { name: "workspaceStaff" })
    async workspaceStaff(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<StaffOptionType>> {
        const result = await this.queryBus.execute(new ListStaffQuery({ request: { workspaceId }, principal }))
        return toStaffOptionsType(result)
    }
}
