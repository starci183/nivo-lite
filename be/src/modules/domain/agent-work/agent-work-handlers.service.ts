import { Injectable } from "@nestjs/common"
import { AgentWorkError, AgentWorkErrorCode } from "./errors/agent-work.error"
import type { AgentWakeSource } from "./agent-work.contracts"
import type { AgentWorkHandler, OptionalAgentWorkHandler } from "./agent-work.port"

@Injectable()
/**
 * The handlers by wake source. Customer, tag and background each register theirs when their module starts; a source without one
 * leaves its wakes held, so the road can land before any handler exists.
 */
export class AgentWorkHandlersService {
    private readonly handlers = new Map<AgentWakeSource, AgentWorkHandler>()

    /** Registers a handler for each source it answers; a second handler for a source is a wiring bug. */
    add(handler: AgentWorkHandler): void {
        for (const source of handler.sources) {
            if (this.handlers.has(source)) {
                throw new AgentWorkError({ code: AgentWorkErrorCode.HandlerDuplicate, params: { source } })
            }
            this.handlers.set(source, handler)
        }
    }

    /** The handler of a source, or undefined when none registered. */
    of(source: AgentWakeSource): OptionalAgentWorkHandler {
        return this.handlers.get(source)
    }
}
