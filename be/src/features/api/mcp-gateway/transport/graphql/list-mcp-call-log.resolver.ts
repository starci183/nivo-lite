import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListMcpCallLogQuery } from "../../application/list-mcp-call-log.query"
import { McpCallLogType } from "./dto/mcp-call-log.type"
import { McpCallLogInput } from "./dto/mcp-call-log.input"
import { toMcpCallLogRequest, toMcpCallLogTypes } from "./mcp-gateway.mapper"

@Resolver()
/** GraphQL door of mcpCallLog. */
export class ListMcpCallLogResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The latest gateway audit lines, secrets masked. */
    @Query(() => [McpCallLogType], { name: "mcpCallLog" })
    async mcpCallLog(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input", { type: () => McpCallLogInput, nullable: true }) input: McpCallLogInput | null,
    ): Promise<Array<McpCallLogType>> {
        const result = await this.queryBus.execute(
            new ListMcpCallLogQuery({ request: toMcpCallLogRequest(workspaceId, input), principal }),
        )
        return toMcpCallLogTypes(result)
    }
}
