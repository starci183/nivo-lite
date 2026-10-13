import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetGoogleStateQuery } from "../../application/get-google-state.query"
import { GoogleStateType } from "./dto/google-state.type"
import { toGetGoogleStateRequest, toGetGoogleStateType } from "./get-google-state.mapper"

@Resolver()
/** GraphQL door of googleConnectionState. */
export class GetGoogleStateResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Asks whether Google can be used on this deployment. */
    @Query(() => GoogleStateType, { name: "googleConnectionState" })
    async googleConnectionState(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<GoogleStateType> {
        const result = await this.queryBus.execute(
            new GetGoogleStateQuery({ request: toGetGoogleStateRequest(workspaceId), principal }),
        )
        return toGetGoogleStateType(result)
    }
}
