import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentWorkHandlersService } from "./agent-work-handlers.service"
import { AgentWorkLogEvent } from "./agent-work.log-events"
import type { AgentEndedWake } from "./agent-work-turns.contracts"

@Injectable()
/**
 * Tells the handler of each wake that `begin` ended with no turn to run. A wake held because the switch is off gets the holding line its
 * handler says; a wake dead past its attempts is logged and told once (the owner for background work, the colleague or the customer
 * otherwise). `begin` reports a wake once, so it is told once; a handler that fails is logged and the rest are still told.
 */
export class AgentEndedWakesService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly handlers: AgentWorkHandlersService,
    ) {}

    /** Tells the handlers, in the order `begin` ended the wakes. */
    tell(ended: ReadonlyArray<AgentEndedWake>): Promise<void> {
        return eachInOrder(ended, ({ state, wake }) => {
            if (state === "dead")
                this.logger.warn(AgentWorkLogEvent.WakeDead, { agentId: wake.agentId, wakeId: wake.wakeId })
            const handler = this.handlers.of(wake.source)
            if (handler === undefined) return Promise.resolve()
            return handler.holdOver(wake, state === "dead" ? "error" : "killed").then(
                () => undefined,
                (cause: unknown) => {
                    this.logger.error(AgentWorkLogEvent.TurnFailed, cause, {
                        agentId: wake.agentId,
                        wakeId: wake.wakeId,
                    })
                },
            )
        })
    }
}
