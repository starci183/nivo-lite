import type { NodeHostPorts } from "../node/host.types"
import type { EffectPayload, NodeStore, SubjectRef } from "../node/node.types"
import { SdkError } from "../sdk-error"

/** What a node test tunes. */
export interface FakeNodePortsOptions {
    readonly store?: NodeStore | undefined
    /** The model's answers, in call order: a text for `text`, a value for `json`. */
    readonly model?: ReadonlyArray<unknown> | undefined
    readonly now?: Date | undefined
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

/** Thrown when a node calls the model more often than its example scripted. */
const unscripted = (): SdkError => new SdkError("MODEL_UNSCRIPTED", "MODEL_UNSCRIPTED")

/**
 * Ports for `runNode` in a test: reads from the store (scope is the host's business, so every row of the kind is in reach), writes and
 * effects recorded and answered with a made-up subject, the model answering from the script. The runner still enforces every right.
 */
export const fakeNodePorts = (options: FakeNodePortsOptions = {}): FakeNodePorts => {
    const executed: Array<FakeExecuted> = []
    const writes: Array<FakeWrite> = []
    const answers = [...(options.model ?? [])]
    const next = (): unknown => {
        if (answers.length === 0) throw unscripted()
        return answers.shift()
    }
    return {
        executed,
        writes,
        ports: {
            read: (kind, query) => {
                const rows = (options.store?.[kind] ?? []).filter((row) => matches(row, query.where ?? {}))
                return Promise.resolve(rows.slice(0, query.limit).map((row) => pick(row, query.fields)))
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
                    return typeof answer === "string" ? Promise.resolve(answer) : Promise.reject(unscripted())
                },
                json: (schema) => Promise.resolve(schema.parse(next())),
            },
            now: () => options.now ?? new Date(0),
        },
    }
}
