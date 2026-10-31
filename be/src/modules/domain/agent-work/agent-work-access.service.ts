import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { AgentWorkError, AgentWorkErrorCode } from "./errors/agent-work.error"

/** One row of a boolean database function. */
interface ExistsRow {
    /** The answer. */
    readonly agent_work_has_agent?: unknown
}

@Injectable()
/** Who may touch an agent's work and which agent is whose: the proof every write of the capability starts with. */
export class AgentWorkAccessService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** The seat of an owner or manager of the workspace, or a typed refusal; staff are refused. */
    async manager(userId: string, workspaceId: string): Promise<string> {
        await this.members.require(userId, workspaceId, ["owner", "manager"])
        return this.members.idOf(userId, workspaceId)
    }

    /** The seat of an owner of the workspace, or a typed refusal; a manager and staff are refused. */
    async owner(userId: string, workspaceId: string): Promise<string> {
        await this.members.require(userId, workspaceId, ["owner"])
        return this.members.idOf(userId, workspaceId)
    }

    /** Proves the agent belongs to the workspace: a caller's workspace id is a selector, never a permission. */
    async agent(workspaceId: string, agentId: string): Promise<void> {
        const [row] = await callDbFunction<ExistsRow>(this.entityManager, "public.agent_work_has_agent", [
            workspaceId,
            agentId,
        ])
        if (row?.agent_work_has_agent !== true) throw new AgentWorkError({ code: AgentWorkErrorCode.AgentNotFound })
    }
}
