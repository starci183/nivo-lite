import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { AgentRunAlertsService, AgentRunsService } from "@modules/domain/agent-runs"
import { AgentGraphFreezeGateService } from "@modules/domain/agent-graphs"
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
 * whichever of the two came first. It registers with the run engine's alerts when the module starts, so the run engine never holds it in a
 * constructor: the work engine it raises through reaches the run engine (a closed item resumes a wait), and a constructor dependency the
 * other way is a provider cycle that hangs the boot without a report. A run that froze its customer raises no review of its own: the
 * freeze's one item per customer stands for it.
 */
export class AgentRunParkedAlertsService implements FlowAlerts, OnModuleInit {
    constructor(
        private readonly runs: AgentRunsService,
        private readonly alerts: AgentRunAlertsService,
        private readonly engine: WorkEngineService,
        private readonly installations: InstallationRecordsService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @Optional() private readonly freezes?: AgentGraphFreezeGateService,
    ) {}

    /** Registers with the run engine's alerts once the app has started. */
    onModuleInit(): void {
        this.alerts.add(this)
    }

    /** Opens the review item of a parked run; an alert of another kind of flow, or of a run that is gone, raises nothing. */
    async raise(alert: ParkedFlowAlert): Promise<void> {
        if (alert.flowKind !== "agent-run") return
        if (alert.workspaceId === undefined) return
        const run = await this.runs.runOf(alert.workspaceId, alert.jobId)
        if (run === null) return
        const stop = { workspaceId: run.workspaceId, runId: run.id, code: alert.reason, stepKey: null, trigger: null }
        if ((await this.freezes?.stopped(stop)) === true) return
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
