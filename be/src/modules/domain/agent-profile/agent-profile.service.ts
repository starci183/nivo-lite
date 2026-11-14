import { Injectable } from "@nestjs/common"
import { AgentDirectoryService, AgentOwnershipService, type Region } from "@modules/domain/agents"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkItemsActivityService } from "@modules/domain/work-items"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type { AgentHead, AgentPage, RecentWork } from "./agent-profile.contracts"
import { AgentProfileLogEvent } from "./agent-profile.log-events"
import { headOf, recentOf } from "./agent-profile.mapper"
import { AgentProfileError, AgentProfileErrorCode } from "./errors/agent-profile.error"
import type { AgentHeadRead } from "./agent-profile-reads.contracts"

const RECENT_LIMIT = 6

@Injectable()
/**
 * The page of one agent: its header, who answers for it, who may give it work, whom it may tag, and its latest work. The ownership comes
 * from the agents capability; the recent work is read on its own and fails on its own, so a failed region never takes the page down. The
 * rules region is always empty: authority rules decide nothing since the engine gate was removed (2026-11-13); the web still reads it.
 */
export class AgentProfileService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly agents: AgentOwnershipService,
        private readonly directory: AgentDirectoryService,
        private readonly installations: InstallationRecordsService,
        private readonly work: WorkItemsActivityService,
    ) {}

    /** The page of an agent for a member of the workspace. */
    async page(userId: string, workspaceId: string, agentId: string): Promise<AgentPage> {
        const ownership = await this.agents.ownershipOf(userId, workspaceId, agentId)
        const head = await this.directory.headOf(workspaceId, agentId)
        if (head === null)
            throw new AgentProfileError({ code: AgentProfileErrorCode.AgentNotFound, params: { id: agentId } })
        const installation = await this.installations.ofAgent(workspaceId, agentId)
        const row: AgentHeadRead = { ...head, roomName: null, operatingMode: installation?.operatingMode ?? null }
        const agent = headOf(row)
        const recent = await this.settle("recent", () => this.recentOf(workspaceId, agent))
        return { agent, ownership, rules: { ok: true, data: [] }, recent }
    }

    private async recentOf(workspaceId: string, agent: AgentHead): Promise<ReadonlyArray<RecentWork>> {
        const rows = await this.work.recentOf(workspaceId, agent.module, RECENT_LIMIT)
        return rows.map((row) => recentOf(row))
    }

    private async settle<T>(region: string, read: () => Promise<T>): Promise<Region<T>> {
        try {
            return { ok: true, data: await read() }
        } catch (cause) {
            this.logger.error(AgentProfileLogEvent.RegionFailed, cause, { region })
            return { ok: false }
        }
    }
}
