import { Injectable, Optional } from "@nestjs/common"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { InjectWakeInterruptions } from "./agent-work.decorators"
import { AgentWorkLogEvent } from "./agent-work.log-events"
import type { AgentTurnView } from "./agent-work.contracts"
import type { WakeInterruptions } from "./agent-work.port"

@Injectable()
/**
 * Tells the durable run of a wake that the runtime answering it went down, so the step it held retries after a backoff and, with its tries
 * spent, reaches a person. With no runs bound nothing is told; a failure here never fails the drain, which still holds the customer's line.
 */
export class AgentWakeInterruptionService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @Optional() @InjectWakeInterruptions() private readonly runs?: WakeInterruptions,
    ) {}

    /** Tells the run of the turn's wake that the runtime went down. */
    async tell(turn: AgentTurnView, signal: AbortSignal): Promise<void> {
        try {
            await this.runs?.interrupted(turn.wakeId, "runtime_down", signal)
        } catch (cause) {
            this.logger.error(AgentWorkLogEvent.TurnFailed, cause, { agentId: turn.agentId, wakeId: turn.wakeId })
        }
    }
}
