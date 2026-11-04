import type { NodeHostPorts } from "../node/host.types"
import type { EffectPayload, NodeStore, SubjectRef } from "../node/node.types"
import { SdkError } from "../sdk-error"

/** What a node test tunes. */
export interface FakeNodePortsOptions {
    readonly store?: NodeStore | undefined
    /** The model's answers, in call order: a text for `text`, a value for `json`. */
    readonly model?: ReadonlyArray<unknown> | undefined
    /** The tools' results, in call order. */
    readonly tools?: ReadonlyArray<unknown> | undefined
    readonly now?: Date | undefined
}

/** One tool call the fake host answered. */
export interface FakeToolCall {
    readonly id: string
    readonly args: Readonly<Record<string, unknown>>
    readonly key: string
}

/** One effect the fake host ran. */
export interface FakeExecuted {
    readonly id: string
    readonly payload: EffectPayload
    readonly key: string
    readonly dedupeKey: string | null
}

/** One write the fake host saw. */
export interface FakeWrite {
    readonly kind: string
    readonly record: Readonly<Record<string, unknown>>
}

/** Fake host ports over an in-memory store, with what they ran recorded. */
export interface FakeNodePorts {
    readonly ports: NodeHostPorts
    readonly executed: ReadonlyArray<FakeExecuted>
    readonly writes: ReadonlyArray<FakeWrite>
    readonly toolCalls: ReadonlyArray<FakeToolCall>
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

/**
 * Ports for `runNode` in a test: reads from the store (scope is the host's business, so every row of the kind is in reach), writes and
 * effects recorded and answered with a made-up subject, the model answering from the script. The runner still enforces every right.
 */
export const scriptedNodePorts = (options: FakeNodePortsOptions = {}): FakeNodePorts => {
    const executed: Array<FakeExecuted> = []
    const writes: Array<FakeWrite> = []
    const toolCalls: Array<FakeToolCall> = []
    const next = scriptOf(options.model, "MODEL_UNSCRIPTED")
    const nextTool = scriptOf(options.tools, "TOOL_UNSCRIPTED")
    return {
        executed,
        writes,
        toolCalls,
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
                return Promise.resolve({ kind: effect.id, id: `${effect.id}-${executed.length}` })
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
        },
    }
}
