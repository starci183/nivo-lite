import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { ToolCallLogQuery } from "../../application/tool-call-log.query"
import { ToolCallLogType } from "./dto/tool-call-log.type"
import { ToolCallLogInput } from "./dto/tool-call-log.input"
import { toToolCallLogRequest, toToolCallLogTypes } from "./tools.mapper"

@Resolver()
/** GraphQL door of toolCallLog. */
export class ToolCallLogResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The latest gateway audit lines, secrets masked. */
    @Query(() => [ToolCallLogType], { name: "toolCallLog" })
    async toolCallLog(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input", { type: () => ToolCallLogInput, nullable: true }) input: ToolCallLogInput | null,
    ): Promise<Array<ToolCallLogType>> {
        const result = await this.queryBus.execute(
            new ToolCallLogQuery({ request: toToolCallLogRequest(workspaceId, input), principal }),
        )
        return toToolCallLogTypes(result)
    }
}
