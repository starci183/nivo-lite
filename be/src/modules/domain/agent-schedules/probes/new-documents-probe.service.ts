import { Injectable } from "@nestjs/common"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { BRIEF_ITEMS, PROBE_WINDOW_MS } from "../agent-schedules.policy"
import type { AgentProbe, ProbeAgent, ProbeAnswer } from "../agent-schedules.contracts"
import { listOf } from "./probe-brief.policy"

@Injectable()
/** Looks at the public documents the agent's module may quote that were added or changed during the last day. */
export class NewDocumentsProbeService implements AgentProbe {
    readonly key = "new_documents"

    constructor(
        private readonly installations: InstallationRecordsService,
        private readonly sources: KnowledgeSourcesReadService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Answers the changed documents, or no work for an agent that has no installation. */
    async check(agent: ProbeAgent): Promise<ProbeAnswer> {
        const installation = await this.installations.ofAgent(agent.workspaceId, agent.agentId)
        if (installation === null) return { work: false }
        const since = new Date(this.clock.now().getTime() - PROBE_WINDOW_MS)
        const changed = await this.sources.changedPublicSince(
            agent.workspaceId,
            installation.moduleKey,
            since.toISOString(),
            0,
            BRIEF_ITEMS + 1,
        )
        if (changed.length === 0) return { work: false }
        return {
            work: true,
            brief: `New or changed documents: ${listOf(changed.map((source) => source.title))}.`,
            subjectIds: changed.slice(0, BRIEF_ITEMS).map((source) => source.id),
        }
    }
}
