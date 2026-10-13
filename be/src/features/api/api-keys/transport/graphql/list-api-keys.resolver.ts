import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListApiKeysQuery } from "../../application/list-api-keys.query"
import { toApiKeysType } from "./api-keys.mapper"
import { ApiKeyType } from "./dto/api-key.type"

@Resolver()
/** GraphQL door of the API keys of the active workspace. */
export class ListApiKeysResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the keys of the active workspace, newest first; owners and managers only. */
    @Query(() => [ApiKeyType], { name: "apiKeys" })
    async apiKeys(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<ApiKeyType>> {
        const result = await this.queryBus.execute(new ListApiKeysQuery({ request: { workspaceId }, principal }))
        return toApiKeysType(result)
    }
}
