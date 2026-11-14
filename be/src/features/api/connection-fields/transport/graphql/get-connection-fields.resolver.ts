import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { GetConnectionFieldsQuery } from "../../application/get-connection-fields.query"
import { GetConnectionFieldsInput } from "./dto/get-connection-fields.input"
import { ConnectionFieldsType } from "./dto/get-connection-fields.type"
import { toConnectionFieldsType, toGetConnectionFieldsRequest } from "./get-connection-fields.mapper"

@Resolver()
/** GraphQL door of connectionFields. */
export class GetConnectionFieldsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The connection form of an account: its declared fields with their public values; a secret answers only whether it is sealed. */
    @Query(() => ConnectionFieldsType, { name: "connectionFields" })
    async connectionFields(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: GetConnectionFieldsInput,
    ): Promise<ConnectionFieldsType> {
        const result = await this.queryBus.execute(
            new GetConnectionFieldsQuery({ request: toGetConnectionFieldsRequest(workspaceId, input), principal }),
        )
        return toConnectionFieldsType(result)
    }
}
