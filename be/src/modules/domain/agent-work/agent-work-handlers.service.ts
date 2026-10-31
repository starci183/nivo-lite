import { Injectable, Optional } from "@nestjs/common"
import { InjectAgentTurnExecutor } from "./agent-work.decorators"
import { AgentWorkError, AgentWorkErrorCode } from "./errors/agent-work.error"
import type { AgentWakeSource } from "./agent-work.contracts"
import type { AgentTurnExecutor, AgentWorkHandler, OptionalAgentTurnExecutor, OptionalAgentWorkHandler } from "./agent-work.port"

@Injectable()
/**
 * Who answers a wake: the handlers by wake source, and the executor that runs their turns. Customer, tag and background each register
 * theirs when their module starts, and the agent turns capability binds the executor; a source without a handler, or a drain with no
 * executor, leaves its wakes held, so the road can land before either exists.
 */
export class AgentWorkHandlersService {
    private readonly handlers = new Map<AgentWakeSource, AgentWorkHandler>()

    constructor(@Optional() @InjectAgentTurnExecutor() private readonly executor?: AgentTurnExecutor) {}

    /** Registers a handler for each source it answers; a second handler for a source is a wiring bug. */
    add(handler: AgentWorkHandler): void {
        for (const source of handler.sources) {
            if (this.handlers.has(source)) {
                throw new AgentWorkError({ code: AgentWorkErrorCode.HandlerDuplicate, params: { source } })
            }
            this.handlers.set(source, handler)
        }
    }

    /** The executor that runs the turns, or undefined while no capability bound one. */
    executorOf(): OptionalAgentTurnExecutor {
        return this.executor
    }

    /** The handler of a source, or undefined when none registered. */
    of(source: AgentWakeSource): OptionalAgentWorkHandler {
        return this.handlers.get(source)
    }
}
