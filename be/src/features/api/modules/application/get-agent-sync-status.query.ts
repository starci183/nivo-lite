import { Query } from "@nestjs/cqrs"
import type { AgentSyncStatus } from "@modules/domain/module-installations"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetAgentSyncStatusRequest } from "./get-agent-sync-status.contracts"

/** Asks where the OpenClaw copy of the agent of an installation stands. */
export class GetAgentSyncStatusQuery extends Query<AgentSyncStatus> {
    constructor(readonly params: ExecuteParams<GetAgentSyncStatusRequest>) {
        super()
    }
}
