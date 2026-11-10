import type { NodeAgentLoop, NodeAgentLoopEnd, NodeHostPorts } from "../../node/host.types"
import type { EffectPayload, NodeStore, SubjectRef } from "../../node/node.types"
import { SdkError } from "../../sdk-error"

/** What a node test tunes. */
export interface FakeNodePortsOptions {
    /** The records the fake reads from, by data kind. */
    readonly store?: NodeStore | undefined
    /** The model's answers, in call order: a text for `text`, a value for `json`. */
    readonly model?: ReadonlyArray<unknown> | undefined
    /** The tools' results, in call order. */
    readonly tools?: ReadonlyArray<unknown> | undefined
    /** What each effect answers, by effect id, in call order (a refusal, a subject with facts); the made-up subject past the list. */
    readonly answers?: Readonly<Record<string, ReadonlyArray<SubjectRef>>> | undefined
    /** The time the fake clock reports; the epoch when absent. */
    readonly now?: Date | undefined
    /**
     * True to take the turns of an agent the way a host with its own loop does (`NodeHostPorts.agent`), from the very same `model`
     * script (`{ call }`, `{ done }`, `{ confused }`, one entry per turn). Absent, the runner takes the turns itself over `model.json`.
     */
    readonly agentLoop?: boolean | undefined
}

/** One hand-over of a step's agent to the fake's own loop, as the runner made it (without its closures). */
export type FakeAgentLoop = Omit<NodeAgentLoop, "call" | "done" | "confused">

/** One fact the fake's own loop showed the model: what a call, an output or a confusion was answered. */
export interface FakeAgentFact {
    /** The scripted turn it answers. */
    readonly turn: unknown
    /** What the runner's closure answered. */
    readonly answer: unknown
}

/** One tool call the fake host answered. */
export interface FakeToolCall {
    /** The id of the tool that was called. */
    readonly id: string
    /** The arguments the runner passed, already parsed. */
    readonly args: Readonly<Record<string, unknown>>
    /** The idempotency key of the call. */
    readonly key: string
}

/** One effect the fake host ran. */
export interface FakeExecuted {
    /** The id of the effect that ran. */
    readonly id: string
    /** The payload the effect ran with. */
    readonly payload: EffectPayload
    /** The key of the effect call. */
    readonly key: string
    /** The business dedupe key of the call, or null. */
    readonly dedupeKey: string | null
}

/** One write the fake host saw. */
export interface FakeWrite {
    /** The data kind written. */
    readonly kind: string
    /** The record written. */
    readonly record: Readonly<Record<string, unknown>>
}

/** Fake host ports over an in-memory store, with what they ran recorded. */
export interface FakeNodePorts {
    /** The ports to hand to `runNode`. */
    readonly ports: NodeHostPorts
    /** The effects run so far, in order. */
    readonly executed: ReadonlyArray<FakeExecuted>
    /** The writes seen so far, in order. */
    readonly writes: ReadonlyArray<FakeWrite>
    /** The tool calls answered so far, in order. */
    readonly toolCalls: ReadonlyArray<FakeToolCall>
    /** The agents handed to the fake's own loop so far (`agentLoop`), in order. */
    readonly agentLoops: ReadonlyArray<FakeAgentLoop>
    /** What the fake's own loop showed the model after each scripted turn, in order. */
    readonly agentFacts: ReadonlyArray<FakeAgentFact>
}

/** Whether a stored row matches every `where` entry. */
const matches = (
    row: Readonly<Record<string, unknown>>,
    where: Readonly<Record<string, string | number | boolean>>,
): boolean => Object.entries(where).every(([name, value]) => row[name] === value)

/** The row cut to the asked fields. */
const pick = (
    row: Readonly<Record<string, unknown>>,
    fields: ReadonlyArray<string>,
): Readonly<Record<string, unknown>> => Object.fromEntries(fields.map((field) => [field, row[field]]))

/** What a call past the end of a script is refused with. */
type Unscripted = "MODEL_UNSCRIPTED" | "TOOL_UNSCRIPTED"

/** Thrown when a node calls the model or a tool more often than its example scripted. */
const unscripted = (code: Unscripted): SdkError => new SdkError(code, code)

/** Answers from a script in order, refusing a call past its end. */
const scriptOf = (answers: ReadonlyArray<unknown> | undefined, code: Unscripted): (() => unknown) => {
    const left = [...(answers ?? [])]
    return () => {
        if (left.length === 0) throw unscripted(code)
        return left.shift()
    }
}

/** A plain object. */
const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * The loop of a host that takes an agent's turns itself, driven by the script: each entry is one model turn, answered through the
 * runner's own closures, until an output or a confusion is taken or the turns run out. It decides nothing: every check is the runner's.
 */
const scriptedAgentLoop =
    (next: () => unknown, loops: Array<FakeAgentLoop>, facts: Array<FakeAgentFact>) =>
    async (loop: NodeAgentLoop): Promise<NodeAgentLoopEnd> => {
        const { call, done, confused, ...shown } = loop
        loops.push(shown)
        const take = async (taken: number): Promise<NodeAgentLoopEnd> => {
            if (taken === loop.maxTurns) return { turns: taken }
            const turn = next()
            if (!isObject(turn)) throw unscripted("MODEL_UNSCRIPTED")
            if (isObject(turn.call)) {
                facts.push({ turn, answer: await call(String(turn.call.tool), turn.call.args) })
                return take(taken + 1)
            }
            const answer = "confused" in turn ? confused(trustedConfusion(turn.confused)) : done(turn.done)
            facts.push({ turn, answer })
            return answer.ok ? { turns: taken + 1 } : take(taken + 1)
        }
        return take(0)
    }

/** A scripted confusion handed on as it is: the runner's closure judges its shape. */
const trustedConfusion = (value: unknown): Parameters<NodeAgentLoop["confused"]>[0] =>
    isObject(value)
        ? {
              reason: typeof value.reason === "string" ? value.reason : "",
              question: typeof value.question === "string" ? value.question : null,
          }
        : { reason: "", question: null }

/**
 * Ports for `runNode` in a test: reads from the store (scope is the host's business, so every row of the kind is in reach), writes and
 * effects recorded and answered with a made-up subject, the model answering from the script. The runner still enforces every right.
 */
export const scriptedNodePorts = (options: FakeNodePortsOptions = {}): FakeNodePorts => {
    const executed: Array<FakeExecuted> = []
    const writes: Array<FakeWrite> = []
    const toolCalls: Array<FakeToolCall> = []
    const agentLoops: Array<FakeAgentLoop> = []
    const agentFacts: Array<FakeAgentFact> = []
    const next = scriptOf(options.model, "MODEL_UNSCRIPTED")
    const nextTool = scriptOf(options.tools, "TOOL_UNSCRIPTED")
    return {
        executed,
        writes,
        toolCalls,
        agentLoops,
        agentFacts,
        ports: {
            read: (kind, query) => {
                const rows = (options.store?.[kind] ?? []).filter((row) => matches(row, query.where ?? {}))
                return Promise.resolve(rows.slice(0, query.limit ?? rows.length).map((row) => pick(row, query.fields)))
            },
            write: (kind, record): Promise<SubjectRef> => {
                writes.push({ kind, record })
                return Promise.resolve({ kind, id: `${kind}-${writes.length}` })
            },
            execute: (effect, payload, call): Promise<SubjectRef> => {
                executed.push({ id: effect.id, payload, ...call })
                const asked = executed.filter((one) => one.id === effect.id).length
                const scripted = options.answers?.[effect.id]?.[asked - 1]
                return Promise.resolve(scripted ?? { kind: effect.id, id: `${effect.id}-${executed.length}` })
            },
            model: {
                text: () => {
                    const answer = next()
                    return typeof answer === "string"
                        ? Promise.resolve(answer)
                        : Promise.reject(unscripted("MODEL_UNSCRIPTED"))
                },
                json: (schema) => Promise.resolve(schema.parse(next())),
            },
            callTool: (tool, args, key) => {
                toolCalls.push({ id: tool.id, args, key })
                return Promise.resolve(nextTool())
            },
            now: () => options.now ?? new Date(0),
            ...(options.agentLoop === true ? { agent: scriptedAgentLoop(next, agentLoops, agentFacts) } : {}),
        },
    }
}
