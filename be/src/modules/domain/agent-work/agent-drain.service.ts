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
import { HEARTBEAT_MAX_BEATS, HEARTBEAT_MS, sessionKeyOf } from "./agent-work.policy"
import type { AgentTurnEnding, AgentTurnUsage, AgentTurnView } from "./agent-work.contracts"
import type {
    AgentHandlerEnding,
    AgentTurnExecutor,
    AgentTurnPlan,
    AgentTurnRun,
    AgentWorkHandler,
} from "./agent-work.port"

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

/** What the executor did: it answered, or it threw (the runtime is down or slow). */
type ModelAttempt =
    { readonly kind: "ran"; readonly run: AgentTurnRun } | { readonly kind: "threw"; readonly cause: unknown }

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
        let beats = 0
        const heartbeat = startLocalInterval(HEARTBEAT_MS, () => {
            beats += 1
            void this.renew(turn, abort, beats)
        })
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
            return { kind: "ending", ending: await this.failure(turn, cause, false) }
        }
    }

    /**
     * How a failed attempt ends. A customer whose runtime is down gets the holding line at once and the wake is done with no retry; any
     * other failure is retried silently until the budget is spent, and the last failure is dead, announced once through the handler (the
     * owner's line for background work, the colleague's or the customer's own line otherwise). The error code still counts toward the breaker.
     */
    private async failure(turn: AgentTurnView, cause: unknown, modelDown: boolean): Promise<AgentTurnEnding> {
        const failed = failedBy(cause)
        const exhausted = turn.attempts >= turn.maxAttempts
        if (exhausted) this.logger.warn(AgentWorkLogEvent.WakeDead, { agentId: turn.agentId, wakeId: turn.wakeId })
        const immediate = modelDown && turn.source === "customer"
        const handler = this.handlers.of(turn.source)
        if (handler === undefined || !(immediate || exhausted)) return failed
        try {
            const ending = await handler.holdOver(turn, "error")
            return immediate ? { ...endingOf(ending, null), errorCode: failed.errorCode } : failed
        } catch (holdCause) {
            this.logger.error(AgentWorkLogEvent.TurnFailed, holdCause, { agentId: turn.agentId, wakeId: turn.wakeId })
            return failed
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
        const plan: AgentTurnPlan = { ...prep.plan, threadKey: sessionKeyOf(prep.plan.threadKey, turn.agentId) }
        await this.turns.bind(turn, plan.runtimeAgentId, plan.threadKey)
        const attempt = await this.attempt(this.executor, turn, plan, signal)
        if (attempt.kind === "threw") {
            this.logger.error(AgentWorkLogEvent.TurnFailed, attempt.cause, {
                agentId: turn.agentId,
                wakeId: turn.wakeId,
            })
            return { kind: "ending", ending: await this.failure(turn, attempt.cause, true) }
        }
        const { run } = attempt
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

    private attempt(
        executor: AgentTurnExecutor,
        turn: AgentTurnView,
        plan: AgentTurnPlan,
        signal: AbortSignal,
    ): Promise<ModelAttempt> {
        return executor.run(turn, plan, signal).then(
            (run): ModelAttempt => ({ kind: "ran", run }),
            (cause: unknown): ModelAttempt => ({ kind: "threw", cause }),
        )
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

    /**
     * Renews the lease; losing it aborts the signal the handler and the executor watch, a failed renewal is logged and tried again. A
     * turn past its beat budget is aborted and no longer renewed, so a hung one cannot hold its scope: the lease lapses and the sweep serves the wake.
     */
    private async renew(turn: AgentTurnView, abort: AbortController, beat: number): Promise<void> {
        if (beat > HEARTBEAT_MAX_BEATS) {
            this.logger.warn(AgentWorkLogEvent.TurnOverran, { agentId: turn.agentId, wakeId: turn.wakeId })
            abort.abort()
            return
        }
        try {
            if (!(await this.turns.touch(turn))) abort.abort()
        } catch (cause) {
            this.logger.error(AgentWorkLogEvent.HeartbeatFailed, cause, { agentId: turn.agentId, wakeId: turn.wakeId })
        }
    }
}
