import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { LEASE_SECONDS, BREAKER_AFTER, BREAKER_SECONDS, retryWaitOf } from "./agent-work.policy"
import { parseBegin, parseDue, parseFinish, parsePropose } from "./agent-work-results.policy"
import { AgentWorkError, AgentWorkErrorCode } from "./errors/agent-work.error"
import { AgentTurnEntity } from "./persistence/entities"
import type {
    AgentBegin,
    AgentFinish,
    AgentProposeResult,
    AgentTurnEnding,
    AgentTurnView,
    AgentWorkDue,
} from "./agent-work.contracts"

/** One row a database function answered: the value sits under the function's own name. */
type FunctionRow = Readonly<Record<string, unknown>>

const rejected = (): AgentWorkError => new AgentWorkError({ code: AgentWorkErrorCode.ResultRejected })

/** A JSON parameter of a database function: the text of the value, so an array is never read as a Postgres array. */
const jsonParameter = (value: unknown): string | null =>
    value === null || value === undefined ? null : JSON.stringify(value)

@Injectable()
/**
 * The lease of an agent's scope over the database functions: begin a turn, keep the lease, store the proposal, end the turn. Every
 * write after `begin` carries the fence, so a worker that lost its lease is refused before any effect. The lease rows are written
 * by the functions only; the back end never updates them.
 */
export class AgentTurnsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Takes the next wake of the scope for `owner`: killed, busy, idle, or a turn begun with its fence. */
    async begin(agentId: string, scopeKey: string, owner: string): Promise<AgentBegin> {
        const [row] = await callDbFunction<FunctionRow>(this.entityManager, "public.agent_turn_begin", [
            agentId,
            scopeKey,
            owner,
            LEASE_SECONDS,
        ])
        const begin = parseBegin(row?.agent_turn_begin, agentId, scopeKey)
        if (begin === null) throw rejected()
        return begin
    }

    /** Extends the lease under the fence; false means another worker holds the scope now. */
    async touch(turn: AgentTurnView): Promise<boolean> {
        const [row] = await callDbFunction<FunctionRow>(this.entityManager, "public.agent_turn_touch", [
            turn.agentId,
            turn.scopeKey,
            turn.fence,
            LEASE_SECONDS,
        ])
        return row?.agent_turn_touch === true
    }

    /** Stores the proposal under the fence: `stored`, `fenced` (stop before any effect) or `killed` (work was switched off meanwhile). */
    async propose(turn: AgentTurnView, proposal: unknown): Promise<AgentProposeResult> {
        const [row] = await callDbFunction<FunctionRow>(this.entityManager, "public.agent_turn_propose", [
            turn.turnId,
            turn.agentId,
            turn.scopeKey,
            turn.fence,
            jsonParameter(proposal),
        ])
        const result = parsePropose(row?.agent_turn_propose)
        if (result === null) throw rejected()
        return result
    }

    /** Ends the turn under the fence and releases the lease; `more` says another wake of the scope is due now. */
    async finish(turn: AgentTurnView, ending: AgentTurnEnding): Promise<AgentFinish> {
        const [row] = await callDbFunction<FunctionRow>(this.entityManager, "public.agent_turn_finish", [
            turn.agentId,
            turn.scopeKey,
            turn.fence,
            turn.turnId,
            ending.status,
            ending.reason,
            jsonParameter(ending.outcome),
            ending.errorCode,
            jsonParameter(ending.usage),
            retryWaitOf(turn.attempts),
            BREAKER_AFTER,
            BREAKER_SECONDS,
        ])
        const finish = parseFinish(row?.agent_turn_finish)
        if (finish === null) throw rejected()
        return finish
    }

    /** What the minute sweep must look at, at most `limit` of each kind. */
    async due(limit: number): Promise<ReadonlyArray<AgentWorkDue>> {
        const rows = await callDbFunction<unknown>(this.entityManager, "public.agent_work_due", [limit])
        const due = parseDue(rows)
        if (due === null) throw rejected()
        return due
    }

    /** Records where the turn runs, so a tool call finds the running turn by its runtime agent and session; a turn that is no longer running is left alone. */
    async bind(turn: AgentTurnView, runtimeAgentId: string, threadKey: string): Promise<void> {
        await this.entityManager.update(
            AgentTurnEntity,
            { id: turn.turnId, status: "running" },
            { runtimeAgentId, threadKey },
        )
    }
}
