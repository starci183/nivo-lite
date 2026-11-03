import { Injectable } from "@nestjs/common"
import { burstOf } from "@nivo-lite/agent-sdk/graph"
import type { GraphSpecTrigger } from "@nivo-lite/agent-sdk/graph"
import type { AgentBurstPolicy, AgentBurstSetting } from "@modules/domain/agent-work"
import { AgentGraphsService } from "./agent-graphs.service"

/** What is kept of an agent's live version: its id, and the trigger of its flow (null when it has none or the version cannot be read). */
interface LiveTrigger {
    readonly versionId: string
    readonly trigger: GraphSpecTrigger | null
}

@Injectable()
/**
 * What the live flow of an agent asks of a burst of tags: the window and the longest wait its trigger names for a kind of tag. The trigger
 * of a version is read once and kept with the version's id, so a wake costs one light lookup of the live version id, and a new
 * version, published or rolled back, is taken up at the next wake.
 */
export class AgentGraphBurstService implements AgentBurstPolicy {
    private readonly live = new Map<string, LiveTrigger>()

    constructor(private readonly graphs: AgentGraphsService) {}

    /** The setting of the live flow of the agent for a kind of tag, or null when it has no flow or the flow asks nothing of it. */
    async burstOf(workspaceId: string, agentId: string, source: string): Promise<AgentBurstSetting | null> {
        const trigger = await this.triggerOf(workspaceId, agentId)
        const kind = trigger?.sources.find((listed) => listed === source)
        return trigger === null || kind === undefined ? null : burstOf(trigger, kind)
    }

    private async triggerOf(workspaceId: string, agentId: string): Promise<GraphSpecTrigger | null> {
        const versionId = await this.graphs.activeVersionIdOf(workspaceId, agentId)
        if (versionId === null) return null
        const kept = this.live.get(agentId)
        if (kept?.versionId === versionId) return kept.trigger
        const document = await this.graphs.documentOf(workspaceId, agentId, versionId).catch(() => null)
        const trigger = document?.flow?.trigger ?? null
        this.live.set(agentId, { versionId, trigger })
        return trigger
    }
}
