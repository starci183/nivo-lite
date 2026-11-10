import { Injectable } from "@nestjs/common"
import type { StepView } from "@modules/domain/agent-runs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import type { StepTrouble } from "./policies/step-trouble.policy"

@Injectable()
/**
 * What a step of a thread that could not complete leaves for developers: the raw technical cause, and the fact that the AI core produced
 * the output instead. The team and the customer are told by the thread itself (the typed stop card of `agent-threads/stops`), never here.
 */
export class AgentGraphRunNoticesService {
    constructor(@InjectLogger() private readonly logger: Logger) {}

    /** Keeps the raw technical cause of a step that could not complete for developers, whatever the AI core then decides. */
    troubled(step: StepView, trouble: StepTrouble): void {
        this.logger.warn(AgentGraphsLogEvent.StepTroubled, {
            runId: step.runId,
            stepKey: step.stepKey,
            kind: trouble.kind,
            code: trouble.code,
            cause: trouble.text,
        })
    }

    /** Records that the AI core produced the output of a step that could not complete, so the run went on. */
    recovered(step: StepView, trouble: StepTrouble): void {
        this.logger.info(AgentGraphsLogEvent.StepRecovered, {
            runId: step.runId,
            stepKey: step.stepKey,
            code: trouble.code,
        })
    }
}
