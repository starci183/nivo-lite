import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentRunHandlersService } from "./agent-run-handlers.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentRunsLogEvent } from "./agent-runs.log-events"
import type { AgentStepHandler, StepView } from "./agent-runs.contracts"

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
 * returned, so a throw leaves it for the sweep to tell again: a stopped run is never silent.
 */
export class AgentRunDeadLetterService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly store: AgentRunStoreService,
        private readonly handlers: AgentRunHandlersService,
    ) {}

    /** Calls the dead letter of the run's handler when nobody was told yet; `stepKey` names the failed step when the caller knows it. */
    async tell(runId: string, stepKey: string | null, code: string): Promise<void> {
        const run = await this.store.runById(runId)
        if (run === null || run.spoken) return
        const steps = await this.store.viewsOf(runId)
        const failed = steps.find((step) => step.stepKey === stepKey) ?? steps.find((step) => step.status === "failed")
        const voice = this.voiceOf(failed, steps)
        if (voice === null) {
            this.logger.warn(AgentRunsLogEvent.DeadWithoutVoice, { runId, code })
            await this.store.spoken(runId)
            return
        }
        try {
            await voice.handler.deadLetter?.(voice.step, code)
        } catch (cause) {
            this.logger.error(AgentRunsLogEvent.DeadLetterFailed, cause, { runId, code })
            return
        }
        if (await this.store.spoken(runId)) this.logger.info(AgentRunsLogEvent.DeadLettered, { runId, code })
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
