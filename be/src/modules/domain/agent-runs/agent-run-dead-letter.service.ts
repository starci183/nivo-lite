import { Injectable, Optional } from "@nestjs/common"
import type { ErrorParams } from "@modules/platform/errors"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentRunAlertsService } from "./agent-run-alerts.service"
import { AgentRunHandlersService } from "./agent-run-handlers.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { InjectAgentRunsOptions } from "./agent-runs.decorators"
import type { AgentRunsOptions } from "./agent-runs.options"
import { AgentRunsLogEvent } from "./agent-runs.log-events"
import type { AgentStepHandler, StepView } from "./agent-runs.contracts"
import type { RunView } from "./agent-runs-engine.contracts"

/** The kind of flow a parked run is told as. */
const AGENT_RUN_FLOW_KIND = "agent-run"

/** The handler that can tell a person, and the step it speaks for. */
interface Voice {
    /** The handler. */
    readonly handler: AgentStepHandler
    /** The step it is told about. */
    readonly step: StepView
}

@Injectable()
/**
 * Tells a person that a run stopped, once. The failed step's handler says it (the trigger intact for the person, the honest holding line to
 * the customer); a step whose kind cannot is replaced by the first step of the run that can. The run is marked told only after the handler
 * returned, so a throw leaves it for the sweep to tell again: a stopped run is never silent. A run that is parked for a fix also raises its one
 * owner item through the alerts registered with the run engine, before the mark, so the item and the mark are never apart.
 */
export class AgentRunDeadLetterService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly store: AgentRunStoreService,
        private readonly handlers: AgentRunHandlersService,
        private readonly alerts: AgentRunAlertsService,
        @Optional() @InjectAgentRunsOptions() private readonly options: AgentRunsOptions | null = null,
    ) {}

    /** Calls the dead letter of the run's handler when nobody was told yet; `stepKey` names the failed step when the caller knows it. */
    async tell(
        workspaceId: string,
        runId: string,
        stepKey: string | null,
        code: string,
        params: ErrorParams = {},
    ): Promise<void> {
        const run = await this.store.runById(workspaceId, runId)
        if (run === null || run.spoken) return
        const steps = await this.store.viewsOf(workspaceId, runId)
        const failed = steps.find((step) => step.stepKey === stepKey) ?? steps.find((step) => step.status === "failed")
        const voice = this.voiceOf(failed, steps)
        if (!(await this.noticed(run, failed ?? steps.at(-1), code))) return
        if (voice === null) {
            this.logger.warn(AgentRunsLogEvent.DeadWithoutVoice, { runId, code, params })
            await this.store.spoken(workspaceId, runId)
            return
        }
        try {
            await voice.handler.deadLetter?.(voice.step, code)
        } catch (cause) {
            this.logger.error(AgentRunsLogEvent.DeadLetterFailed, cause, { runId, code, params })
            return
        }
        if (await this.store.spoken(workspaceId, runId))
            this.logger.info(AgentRunsLogEvent.DeadLettered, { runId, code, params })
    }

    /** Raises the one owner item of a parked run; false when it could not, so the run stays untold and the sweep tries again. */
    private async noticed(run: RunView, step: StepView | undefined, code: string): Promise<boolean> {
        if (run.status !== "parked" || step === undefined) return true
        try {
            await this.alerts.raise({
                kind: "flow-parked",
                jobId: run.id,
                workspaceId: run.workspaceId,
                flowKind: AGENT_RUN_FLOW_KIND,
                failureClass: "code",
                reason: code,
                correlationId: run.wakeId,
                build: this.options?.buildId ?? "",
                action: "resume",
            })
            return true
        } catch (cause) {
            this.logger.error(AgentRunsLogEvent.DeadLetterFailed, cause, { runId: run.id, code })
            return false
        }
    }

    private voiceOf(failed: StepView | undefined, steps: ReadonlyArray<StepView>): Voice | null {
        const candidates = failed === undefined ? steps : [failed, ...steps]
        for (const step of candidates) {
            const handler = this.handlers.of(step.kind)
            if (handler?.deadLetter !== undefined) return { handler, step: failed ?? step }
        }
        return null
    }
}
