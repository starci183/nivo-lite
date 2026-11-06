import { Injectable, Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AGENT_RUN_WAIT_TIMEOUT } from "../../modules/domain/agent-runs/agent-runs.decorators"
import { AgentRunHandlersService } from "../../modules/domain/agent-runs/agent-run-handlers.service"
import { TOOL_OUTCOME_UNKNOWN } from "../../modules/domain/agent-runs/policies/agent-runs.policy"
import type {
    AgentStepHandler,
    StepAnswer,
    StepDecision,
    StepJson,
    StepSpec,
    StepView,
} from "../../modules/domain/agent-runs/agent-runs.contracts"
import type { AgentRunWaitTimeout, WaitExpiry } from "../../modules/domain/agent-runs/agent-runs-engine.contracts"

/** A promise a proof settles by hand. */
interface Deferred {
    /** Settles the promise. */
    readonly release: () => void
    /** Resolves when released. */
    readonly released: Promise<void>
}

/** Where a handler stops: before its effect, or after it and before its result is stored. */
export type HangPhase = "before" | "after"

/** The hang a proof set on a handler: it was reached, and it is let go. */
interface HangPair {
    /** Settled by the handler when it reaches the hang. */
    readonly entered: Deferred
    /** Settled by the proof to let the handler go on. */
    readonly release: Deferred
}

/** A hang the proof set: the handler reached it (`entered`) and stays there until the proof releases it, the way a killed worker stops. */
export interface Hang {
    /** Resolves when a handler reached the hang. */
    readonly entered: Promise<void>
    /** Lets the hung handler go on, after the run was taken over. */
    readonly release: () => void
}

/** The settle function of a deferred, kept until the promise is made. */
interface Settler {
    /** Settles the promise. */
    release: () => void
}

const deferred = (): Deferred => {
    const state: Settler = { release: () => undefined }
    const released = new Promise<void>((resolve) => {
        state.release = resolve
    })
    return { release: state.release, released }
}

@Injectable()
/**
 * The world the scripted handlers of a run act on, recorded so a proof can count what happened: every effect, the receipts of the tool,
 * what a person was told, and the hangs that stand for a killed worker.
 */
export class ScriptedWorld {
    /** Every effect on the world, in order: tool calls, undone calls, sent replies. */
    readonly performed: Array<string> = []

    /** What the tool stored under its idempotency key: the receipt of the gateway. */
    readonly receipts: Map<string, Readonly<Record<string, unknown>>> = new Map<string, StepJson>()

    /** The keys a tool began and never stored: the gateway cannot say whether the tool acted. */
    readonly started: Set<string> = new Set<string>()

    /** The keys of the replies that were sent. */
    readonly sent: Set<string> = new Set<string>()

    /** What a person was told: the failing step and its code, in order. */
    readonly told: Array<string> = []

    /** How many times each kind of handler ran. */
    readonly calls: Map<string, number> = new Map<string, number>()

    /** Answers the next tries of the tool give, in order; once empty the tool acts. */
    toolTries: Array<StepAnswer> = []

    /** Called when a handler answered and before the engine stores it, by kind. */
    readonly afterAnswer: Map<string, () => void> = new Map<string, () => void>()

    private readonly hangs = new Map<string, HangPair>()

    /** Makes the first call of `kind` hang at `phase`. */
    hangOnce(kind: string, phase: HangPhase): Hang {
        const pair = { entered: deferred(), release: deferred() }
        this.hangs.set(`${kind}:${phase}`, pair)
        return { entered: pair.entered.released, release: pair.release.release }
    }

    /** Waits at the hang of `kind` and `phase` when one is set, once. */
    async hang(kind: string, phase: HangPhase): Promise<void> {
        const key = `${kind}:${phase}`
        const pair = this.hangs.get(key)
        if (pair === undefined) return
        this.hangs.delete(key)
        pair.entered.release()
        await pair.release.released
    }

    /** Counts a call of a kind. */
    called(kind: string): void {
        this.calls.set(kind, (this.calls.get(kind) ?? 0) + 1)
    }

    /** Forgets what the last proof did. */
    reset(): void {
        this.performed.length = 0
        this.receipts.clear()
        this.started.clear()
        this.sent.clear()
        this.told.length = 0
        this.calls.clear()
        this.toolTries = []
        this.afterAnswer.clear()
        this.hangs.clear()
    }
}

/** A step spec of the customer chain. */
export const specOf = (stepKey: string, kind: string, effect: StepSpec["effect"], input: StepJson = {}): StepSpec => ({
    stepKey,
    nodeKey: `node-${kind}`,
    kind,
    effect,
    input,
})

/** The steps every proof chains: door (compensable), tool (compensable), reply (pivot). */
export const chainFrom = (kind: "door" | "tool" | "reply", wakeId: string): StepSpec => {
    if (kind === "door") return specOf("door", "door", { kind: "compensable", compensation: "undo_door" }, { wakeId })
    if (kind === "tool") return specOf("tool", "tool", { kind: "compensable", compensation: "undo_tool" }, { wakeId })
    return specOf("reply", "reply", { kind: "pivot" }, { wakeId })
}

const wakeOf = (step: StepView): string => (typeof step.input.wakeId === "string" ? step.input.wakeId : step.runId)

const doneBy = (world: ScriptedWorld, kind: string, result: StepJson, next: ReadonlyArray<StepSpec>): StepAnswer => {
    world.afterAnswer.get(kind)?.()
    return { kind: "done", result, next }
}

const toldBy =
    (world: ScriptedWorld) =>
    (step: StepView, code: string): Promise<void> => {
        world.told.push(`${step.stepKey}:${code}`)
        return Promise.resolve()
    }

const undoOf = (world: ScriptedWorld, kind: string, label: string): AgentStepHandler => ({
    kind,
    run: () => Promise.resolve({ kind: "failed", code: "never_run_forward" }),
    compensate: (step) => {
        world.performed.push(`undo:${label}:${wakeOf(step)}`)
        return Promise.resolve()
    },
})

const turnAndDoor = (world: ScriptedWorld): ReadonlyArray<AgentStepHandler> => [
    {
        kind: "turn",
        run: async (step) => {
            world.called("turn")
            await world.hang("turn", "before")
            return doneBy(world, "turn", { reply: "Yes, of course" }, [chainFrom("door", wakeOf(step))])
        },
        deadLetter: toldBy(world),
    },
    {
        kind: "door",
        run: (step) => {
            world.called("door")
            world.performed.push(`door:${wakeOf(step)}`)
            return Promise.resolve(doneBy(world, "door", { opened: true }, [chainFrom("tool", wakeOf(step))]))
        },
        deadLetter: toldBy(world),
    },
    undoOf(world, "undo_door", "door"),
]

const toolAndUndo = (world: ScriptedWorld): ReadonlyArray<AgentStepHandler> => [
    {
        kind: "tool",
        run: async (step) => {
            world.called("tool")
            const key = `tool:${wakeOf(step)}`
            const next = [chainFrom("reply", wakeOf(step))]
            const receipt = world.receipts.get(key)
            if (receipt !== undefined) return doneBy(world, "tool", receipt, next)
            if (world.started.has(key)) return { kind: "failed", code: TOOL_OUTCOME_UNKNOWN }
            const scripted = world.toolTries.shift()
            if (scripted !== undefined) return scripted
            await world.hang("tool", "before")
            world.performed.push(key)
            world.receipts.set(key, { orderId: key })
            await world.hang("tool", "after")
            return doneBy(world, "tool", { orderId: key }, next)
        },
        deadLetter: toldBy(world),
    },
    undoOf(world, "undo_tool", "tool"),
]

const askOf = (world: ScriptedWorld, kind: string, decides: boolean): AgentStepHandler => ({
    kind,
    run: (step) =>
        Promise.resolve({
            kind: "wait",
            workItemId: String(step.input.itemId),
            deadlineAt: new Date(String(step.input.deadlineAt)),
        }),
    deadLetter: toldBy(world),
    ...(decides
        ? {
              onDecided: (step: StepView, decision: StepDecision): StepAnswer => ({
                  kind: "done",
                  result: { approved: decision.approved, by: decision.by },
                  next: decision.approved ? [chainFrom("reply", wakeOf(step))] : [],
              }),
          }
        : {}),
})

const replyAndOthers = (world: ScriptedWorld): ReadonlyArray<AgentStepHandler> => [
    {
        kind: "reply",
        run: async (step) => {
            world.called("reply")
            const key = `reply:${wakeOf(step)}`
            await world.hang("reply", "before")
            if (!world.sent.has(key)) {
                world.sent.add(key)
                world.performed.push(key)
            }
            await world.hang("reply", "after")
            return doneBy(world, "reply", { sent: key }, [])
        },
        deadLetter: toldBy(world),
    },
    askOf(world, "ask", true),
    askOf(world, "ask_plain", false),
    {
        kind: "late",
        run: () => Promise.resolve({ kind: "failed", code: "late_failure" }),
        deadLetter: toldBy(world),
    },
]

/** The handlers of the customer chain (turn, door, tool, reply) and of a wait and a late failure, acting on the scripted world. */
export const handlersOf = (world: ScriptedWorld): ReadonlyArray<AgentStepHandler> => [
    ...turnAndDoor(world),
    ...toolAndUndo(world),
    ...replyAndOthers(world),
]

@Injectable()
/** The graph's timeout as a proof scripts it: which work items it was asked about, and what it answers. */
export class ScriptedTimeout implements AgentRunWaitTimeout {
    /** The work items the sweep asked the graph to time out. */
    readonly asked: Array<string> = []

    /** What the graph answers. */
    answer: WaitExpiry = { kind: "ended" }

    /** Records the work item and answers what the proof scripted. */
    expire(workItemId: string): Promise<WaitExpiry> {
        this.asked.push(workItemId)
        return Promise.resolve(this.answer)
    }
}

@Injectable()
class HandlersRegistration {
    constructor(registry: AgentRunHandlersService, world: ScriptedWorld) {
        handlersOf(world).forEach((handler) => registry.add(handler))
    }
}

@Module({})
/** The scripted world of the runs, bound the way the capabilities that own the steps bind theirs. */
export class ScriptedRunsModule {
    /** Binds the scripted world, its handlers and the graph's timeout the way the capabilities that own them bind theirs. */
    static register(): DynamicModule {
        return {
            module: ScriptedRunsModule,
            global: true,
            providers: [
                ScriptedWorld,
                ScriptedTimeout,
                HandlersRegistration,
                { provide: AGENT_RUN_WAIT_TIMEOUT, useExisting: ScriptedTimeout },
            ],
            exports: [ScriptedWorld, ScriptedTimeout, AGENT_RUN_WAIT_TIMEOUT],
        }
    }
}
