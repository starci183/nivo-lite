import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ShiftsMineQuery } from "../../application/shifts-mine.query"
import { ShiftsMineType } from "./dto/shifts-mine.type"
import { toShiftsMineRequest, toShiftsMineType } from "./shifts-workbench.mapper"

@Resolver()
/** GraphQL door: the signed-in person's own shifts view. */
export class ShiftsMineResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The signed-in person's own shifts view. */
    @Query(() => ShiftsMineType, { name: "shiftsMine" })
    async shiftsMine(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<ShiftsMineType> {
        const result = await this.queryBus.execute(
            new ShiftsMineQuery({ request: toShiftsMineRequest(workspaceId), principal }),
        )
        return toShiftsMineType(result)
    }
}
