import { Injectable } from "@nestjs/common"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { FlowAlerts, ParkedFlowAlert } from "@modules/platform/jobs"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { WorkEngineService } from "./work-engine.service"
import type { WorkSpec } from "./decisions.contracts"

/** The name under which the flow raises work in the Office. */
const ACTOR = "NIVO"

/** The action of the review item of a run, and the business key a graph node's own review of the same run is filed under. */
const RUN_REVIEW_ACTION = "review_agent_run"
const dedupeKeyOf = (runId: string): string => `graph-node:work-item.raise:graph-run-dead:${runId}`

/** The text of a member of a record, or null. */
const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

@Injectable()
/**
 * Tells the owner a run stopped for a fix, once: one work item that a person reviews, and approving it runs the run again from its failed
 * step. It is filed under the same business key as the review a graph node raises for the same run, so the owner sees one item per run
 * whichever of the two came first.
 */
export class AgentRunParkedAlertsService implements FlowAlerts {
    constructor(
        private readonly runs: AgentRunsService,
        private readonly engine: WorkEngineService,
        private readonly installations: InstallationRecordsService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {}

    /** Opens the review item of a parked run; an alert of another kind of flow, or of a run that is gone, raises nothing. */
    async raise(alert: ParkedFlowAlert): Promise<void> {
        if (alert.flowKind !== "agent-run") return
        const run = await this.runs.runOf(alert.jobId)
        if (run === null) return
        const conversationId = textOf(run.context.conversationId)
        const locale: Locale = run.context.locale === "en" ? "en" : "vi"
        const installation = await this.installations.ofAgent(run.workspaceId, run.agentId)
        const spec: WorkSpec = {
            action: RUN_REVIEW_ACTION,
            ...(installation === null ? {} : { department: installation.moduleKey }),
            subject_type: "conversation",
            subject_id: conversationId,
            dedupeKey: dedupeKeyOf(run.id),
            seed: {
                summary: this.catalog.get("decisions.runParked.title", {}, locale),
                fields: { runId: run.id, code: alert.reason, conversationId },
            },
            preset: true,
            forceAsk: "branch_ask",
        }
        await this.engine.runWork({ workspaceId: run.workspaceId, actor: ACTOR, locale }, spec)
    }
}
