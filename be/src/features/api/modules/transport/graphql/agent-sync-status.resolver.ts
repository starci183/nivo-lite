import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetAgentSyncStatusQuery } from "../../application/get-agent-sync-status.query"
import { AgentSyncStatusType } from "./dto/agent-sync-status.type"
import { ModuleInstallationIdInput } from "./dto/module-installation-id.input"
import { toAgentSyncStatusType, toGetAgentSyncStatusRequest } from "./modules.mapper"

@Resolver()
/** GraphQL door of the OpenClaw sync status of an agent. */
export class AgentSyncStatusResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Where the OpenClaw copy of the agent of an installation stands; poll it after `requestAgentSync`. */
    @Query(() => AgentSyncStatusType, { name: "agentSyncStatus" })
    async agentSyncStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ModuleInstallationIdInput,
    ): Promise<AgentSyncStatusType> {
        const result = await this.queryBus.execute(
            new GetAgentSyncStatusQuery({ request: toGetAgentSyncStatusRequest(workspaceId, input), principal }),
        )
        return toAgentSyncStatusType(result)
    }
}
