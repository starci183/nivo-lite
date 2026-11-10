import { Injectable } from "@nestjs/common"
import { AgentRunsError, AgentRunsErrorCode } from "./errors/agent-runs.error"
import type { AgentStepHandler } from "./agent-runs.contracts"
import type { OptionalAgentStepHandler } from "./agent-runs-engine.contracts"

/** Told that a run ended `done`, after the commit that ended it. */
export type AgentRunEnded = (workspaceId: string, runId: string) => Promise<void>

@Injectable()
/**
 * Who does the work of a step: the handlers by step kind. Each capability that owns a kind registers its handler when its module starts
 * (`onModuleInit`), the way the handlers of a wake source register. A kind with no handler fails its step visibly, so a graph can name a
 * node before the capability that performs it exists.
 */
export class AgentRunHandlersService {
    private readonly handlers = new Map<string, AgentStepHandler>()

    private readonly endings: Array<AgentRunEnded> = []

    /**
     * Registers who is told, after the commit, that a run the job drove ended `done` (a freeze whose retry outlived the door's answer
     * settles then, not on the customer's next message).
     */
    onEnded(listener: AgentRunEnded): void {
        this.endings.push(listener)
    }

    /** Tells every listener that the run ended; a listener that fails is the listener's to log, never the run's. */
    async ended(workspaceId: string, runId: string): Promise<void> {
        for (const listener of this.endings) await listener(workspaceId, runId)
    }

    /** Registers a handler under the kind it names; a second handler for a kind is a wiring bug. */
    add(handler: AgentStepHandler): void {
        if (this.handlers.has(handler.kind)) {
            throw new AgentRunsError({ code: AgentRunsErrorCode.HandlerDuplicate, params: { kind: handler.kind } })
        }
        this.handlers.set(handler.kind, handler)
    }

    /** The handler of a kind, or undefined when none registered. */
    of(kind: string): OptionalAgentStepHandler {
        return this.handlers.get(kind)
    }
}
