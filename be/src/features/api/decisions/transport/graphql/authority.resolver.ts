import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ReadAuthorityQuery } from "../../application/read-authority.query"
import { AuthoritySheetType } from "./dto/authority-sheet.type"
import { toAuthoritySheetType, toReadAuthorityRequest } from "./decisions.mapper"

@Resolver()
/** GraphQL door of the owner authority. */
export class AuthorityResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the goals, house rules and every rule. */
    @Query(() => AuthoritySheetType, { name: "authority" })
    async authority(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<AuthoritySheetType> {
        const result = await this.queryBus.execute(
            new ReadAuthorityQuery({ request: toReadAuthorityRequest(workspaceId), principal }),
        )
        return toAuthoritySheetType(result)
    }
}
