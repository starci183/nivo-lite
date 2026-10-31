import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { isDomainError } from "@modules/platform/errors"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { startLocalInterval } from "@modules/platform/queue"
import { InjectAgentTurnQueue } from "@modules/queues/agent-turn"
import type { AgentTurnDrainPayload, AgentTurnQueue } from "@modules/queues/agent-turn"
import { InjectAgentTurnExecutor } from "./agent-work.decorators"
import { AgentTurnsService } from "./agent-turns.service"
import { AgentWorkHandlersService } from "./agent-work-handlers.service"
import { AgentWorkLogEvent } from "./agent-work.log-events"
import { HEARTBEAT_MS } from "./agent-work.policy"
import type { AgentTurnEnding, AgentTurnUsage, AgentTurnView } from "./agent-work.contracts"
import type { AgentHandlerEnding, AgentTurnExecutor, AgentWorkHandler } from "./agent-work.port"

/** Where a turn stands after one step: it ended, or its worker lost the lease and must stop with no further write. */
type Step = { readonly kind: "ending"; readonly ending: AgentTurnEnding } | { readonly kind: "fenced" }

const endingOf = (ending: AgentHandlerEnding, usage: AgentTurnUsage | null): AgentTurnEnding => ({
    status: ending.status,
    reason: ending.reason,
    outcome: ending.outcome,
    errorCode: null,
    usage,
})

const heldBy = (reason: string): AgentTurnEnding => ({
    status: "held",
    reason,
    outcome: null,
    errorCode: null,
    usage: null,
})

const failedBy = (cause: unknown): AgentTurnEnding => ({
    status: "failed",
    reason: "error",
    outcome: null,
    errorCode: isDomainError(cause) ? cause.code : "AGENT_WORK_UNEXPECTED",
    usage: null,
})

@Injectable()
/**
 * Runs one turn of an agent's scope: the lease from the database, the handler of the wake's source for the business, the executor
 * for the model. It holds the order and no business. A worker that dies leaves the rest to the lease: the sweep drives the next
 * drain and `begin` takes the wake over, with the stored proposal when the last attempt reached one.
 */
export class AgentDrainService {
    private readonly owner: string

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
        @InjectIds() ids: Ids,
        @InjectAgentTurnQueue() private readonly queue: AgentTurnQueue,
        private readonly turns: AgentTurnsService,
        private readonly handlers: AgentWorkHandlersService,
        @Optional() @InjectAgentTurnExecutor() private readonly executor?: AgentTurnExecutor,
    ) {
        this.owner = ids.next()
    }

    /** Takes one turn of the scope and runs it; when more is due in the scope, starts the next drain after it. A busy or idle scope ends quietly. */
    async drain(payload: AgentTurnDrainPayload): Promise<void> {
        const begin = await this.turns.begin(payload.agentId, payload.scopeKey, this.owner)
        if (begin.result === "busy") {
            this.logger.info(AgentWorkLogEvent.TurnBusy, { agentId: payload.agentId, scopeKey: payload.scopeKey })
            return
        }
        if (begin.result !== "begun") return
        const { turn } = begin
        this.logger.info(AgentWorkLogEvent.TurnBegun, { agentId: turn.agentId, wakeId: turn.wakeId, fence: turn.fence })
        const abort = new AbortController()
        const heartbeat = startLocalInterval(HEARTBEAT_MS, () => void this.renew(turn, abort))
        try {
            const step = await this.step(turn, abort.signal)
            if (step.kind === "ending") await this.end(payload, turn, step.ending)
        } finally {
            heartbeat.cancel()
        }
    }

    private async step(turn: AgentTurnView, signal: AbortSignal): Promise<Step> {
        try {
            return await this.run(turn, signal)
        } catch (cause) {
            this.logger.error(AgentWorkLogEvent.TurnFailed, cause, { agentId: turn.agentId, wakeId: turn.wakeId })
            return { kind: "ending", ending: failedBy(cause) }
        }
    }

    private run(turn: AgentTurnView, signal: AbortSignal): Promise<Step> {
        const handler = this.handlers.of(turn.source)
        if (handler === undefined) {
            this.logger.warn(AgentWorkLogEvent.NoHandler, { agentId: turn.agentId, source: turn.source })
            return Promise.resolve({ kind: "ending", ending: heldBy("no_handler") })
        }
        if (turn.proposal !== null) return this.settle(handler, turn, turn.proposal, null, signal)
        return this.propose(handler, turn, signal)
    }

    private async propose(handler: AgentWorkHandler, turn: AgentTurnView, signal: AbortSignal): Promise<Step> {
        const prep = await handler.prepare(turn, signal)
        if (prep.kind === "end") return { kind: "ending", ending: endingOf(prep.ending, null) }
        if (this.executor === undefined) return { kind: "ending", ending: heldBy("no_executor") }
        await this.turns.bind(turn, prep.plan.runtimeAgentId, prep.plan.threadKey)
        const run = await this.executor.run(turn, prep.plan, signal)
        if (run.kind === "blocked") {
            return { kind: "ending", ending: endingOf(await handler.holdOver(turn, run.reason), null) }
        }
        const stored = await this.turns.propose(turn, run.proposal)
        if (stored === "fenced") {
            this.logger.warn(AgentWorkLogEvent.TurnFenced, { agentId: turn.agentId, wakeId: turn.wakeId })
            return { kind: "fenced" }
        }
        if (stored === "killed") {
            await handler.holdOver(turn, "killed")
            return { kind: "ending", ending: heldBy("killed") }
        }
        return this.settle(handler, turn, run.proposal, run.usage, signal)
    }

    private async settle(
        handler: AgentWorkHandler,
        turn: AgentTurnView,
        proposal: unknown,
        usage: AgentTurnUsage | null,
        signal: AbortSignal,
    ): Promise<Step> {
        return { kind: "ending", ending: endingOf(await handler.settle(turn, proposal, signal), usage) }
    }

    private async end(payload: AgentTurnDrainPayload, turn: AgentTurnView, ending: AgentTurnEnding): Promise<void> {
        const finish = await this.turns.finish(turn, ending)
        if (finish.fenced) {
            this.logger.warn(AgentWorkLogEvent.TurnFenced, { agentId: turn.agentId, wakeId: turn.wakeId })
            return
        }
        if (finish.more) {
            await this.entityManager.transaction((tx) => this.queue.enqueueNextDrain(payload, turn.turnId, tx))
        }
    }

    /** Renews the lease; losing it aborts the signal the handler and the executor watch, a failed renewal is logged and tried again. */
    private async renew(turn: AgentTurnView, abort: AbortController): Promise<void> {
        try {
            if (!(await this.turns.touch(turn))) abort.abort()
        } catch (cause) {
            this.logger.error(AgentWorkLogEvent.HeartbeatFailed, cause, { agentId: turn.agentId, wakeId: turn.wakeId })
        }
    }
}
