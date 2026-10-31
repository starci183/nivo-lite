import { Injectable, Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AGENT_TURN_EXECUTOR } from "../../modules/domain/agent-work/agent-work.decorators"
import { AgentWorkHandlersService } from "../../modules/domain/agent-work/agent-work-handlers.service"
import { AgentWorkModule } from "../../modules/domain/agent-work"
import type { AgentWakeSource, AgentTurnView } from "../../modules/domain/agent-work/agent-work.contracts"
import type {
    AgentHandlerEnding,
    AgentTurnExecutor,
    AgentTurnPlan,
    AgentTurnPrep,
    AgentTurnRun,
    AgentWorkHandler,
} from "../../modules/domain/agent-work/agent-work.port"
import { IdsModule } from "@modules/platform/ids"
import { OFFICE_CHAIN_MODULES } from "./office-chain-capabilities.options"
import { QUEUE_MODULES } from "./test-capabilities.options"

/** What a proof scripts into the turn: how the model answers and what settling does, per turn. */
export interface AgentWorkScript {
    /** Answers the model call of a turn; the default proposes `ok`. */
    readonly run?: (turn: AgentTurnView, signal: AbortSignal) => Promise<AgentTurnRun>
    /** Applies a proposal; the default is done. */
    readonly settle?: (turn: AgentTurnView, proposal: unknown) => Promise<AgentHandlerEnding>
}

const DONE: AgentHandlerEnding = { status: "done", reason: null, outcome: { settled: true } }

const whenAborted = (signal: AbortSignal): Promise<void> =>
    signal.aborted
        ? Promise.resolve()
        : new Promise((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }))

@Injectable()
/**
 * The scripted handler and executor of the store proofs: no model and no business, only the order the drain walks them in. A proof sets
 * `script` before it drains and reads what ran from `ran` and `settled`.
 */
export class ScriptedAgentWork implements AgentWorkHandler, AgentTurnExecutor {
    readonly sources: ReadonlyArray<AgentWakeSource> = ["customer", "tag", "internal", "schedule"]

    /** The script of the proof now running. */
    script: AgentWorkScript = {}

    /** The wake ids whose model call began, in order. */
    readonly ran: Array<string> = []

    /** The wake ids that were settled, in order. */
    readonly settled: Array<string> = []

    /** The most model calls that were in flight at once. */
    peak = 0

    private inFlight = 0

    private gate: AbortController | null = null

    private readonly waiters: Array<{ readonly count: number; readonly wake: () => void }> = []

    constructor(registry: AgentWorkHandlersService) {
        registry.add(this)
    }

    prepare(turn: AgentTurnView): Promise<AgentTurnPrep> {
        const plan: AgentTurnPlan = {
            module: "chatbot",
            runtimeAgentId: `runtime-${turn.agentId}`,
            threadKey: `thread-${turn.scopeKey}`,
            message: "scripted",
            timeoutMs: 1000,
        }
        return Promise.resolve({ kind: "run", plan })
    }

    async run(turn: AgentTurnView, _plan: AgentTurnPlan, signal: AbortSignal): Promise<AgentTurnRun> {
        this.ran.push(turn.wakeId)
        this.inFlight += 1
        this.peak = Math.max(this.peak, this.inFlight)
        this.waiters.filter((waiter) => waiter.count <= this.ran.length).forEach((waiter) => waiter.wake())
        try {
            if (this.gate !== null) await whenAborted(this.gate.signal)
            return await (this.script.run?.(turn, signal) ??
                Promise.resolve<AgentTurnRun>({ kind: "proposal", proposal: { reply: "ok" }, usage: null }))
        } finally {
            this.inFlight -= 1
        }
    }

    async settle(turn: AgentTurnView, proposal: unknown): Promise<AgentHandlerEnding> {
        this.settled.push(turn.wakeId)
        return (await this.script.settle?.(turn, proposal)) ?? DONE
    }

    holdOver(): Promise<AgentHandlerEnding> {
        return Promise.resolve({ status: "done", reason: "held_over", outcome: null })
    }

    /** Resolves once this many model calls have begun. */
    entered(count: number): Promise<void> {
        if (this.ran.length >= count) return Promise.resolve()
        return new Promise((resolve) => {
            this.waiters.push({ count, wake: () => resolve() })
        })
    }

    /** Holds every model call from now on until the function this answers is called. */
    hold(): () => void {
        const gate = new AbortController()
        this.gate = gate
        return () => gate.abort()
    }

    /** Forgets what the last proof scripted and saw. */
    reset(): void {
        this.gate?.abort()
        this.gate = null
        this.waiters.length = 0
        this.script = {}
        this.ran.length = 0
        this.settled.length = 0
        this.peak = 0
    }
}

@Module({})
class ScriptedAgentWorkModule {
    /** Binds the scripted handler and executor the way the capabilities that own them bind theirs. */
    static register(): DynamicModule {
        return {
            module: ScriptedAgentWorkModule,
            global: true,
            providers: [ScriptedAgentWork, { provide: AGENT_TURN_EXECUTOR, useExisting: ScriptedAgentWork }],
            exports: [ScriptedAgentWork, AGENT_TURN_EXECUTOR],
        }
    }
}

/** The agent work store as the api composes it: the office (workspace, members, agents), the queue outbox and the capability, with a scripted handler and executor. */
export const AGENT_WORK_MODULES = [
    ...OFFICE_CHAIN_MODULES,
    ...QUEUE_MODULES,
    IdsModule.register({ isGlobal: true }),
    AgentWorkModule.register({ isGlobal: true }),
    ScriptedAgentWorkModule.register(),
]
