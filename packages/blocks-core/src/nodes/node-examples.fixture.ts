import type { NodeContext, NodeDefinition, NodeQuery, SubjectRef } from "@nivo-lite/agent-sdk/node"

/** An effect a node recorded in a test. */
export interface RecordedEffect {
    readonly kind: string
    readonly payload: unknown
}

/** What a test tunes in the context of an example. */
export interface ContextOptions {
    /** The turn's subject; a conversation `c1` when absent, null for none. */
    readonly subject?: SubjectRef | null
}

/** A node example as `defineNode` types it, with the members this fixture reads. */
type AnyExample = NodeDefinition["examples"][number]

const CONVERSATION: SubjectRef = { kind: "conversation", id: "c1" }

/** A node context over the store and the canned model answers of an example; the effects it sees go to `effects`. */
export const contextOfExample = (
    node: NodeDefinition,
    example: AnyExample,
    effects: Array<RecordedEffect>,
    options: ContextOptions = {},
): NodeContext => {
    const replies = [...(example.model ?? [])]
    return {
        turn: {
            turnId: "turn-1",
            workspaceId: "workspace-1",
            agentId: "agent-1",
            subject: options.subject === undefined ? CONVERSATION : options.subject,
        },
        params: node.params.parse(example.params),
        data: {
            read: <T>(kind: string, query: NodeQuery): Promise<ReadonlyArray<T>> => {
                const rows = (example.store?.[kind] ?? []).filter((row) =>
                    Object.entries(query.where ?? {}).every(([name, value]) => row[name] === value),
                )
                return Promise.resolve(rows as unknown as ReadonlyArray<T>)
            },
            write: (kind) => Promise.resolve({ kind, id: `${kind}-1` }),
        },
        effect: (kind, subject, payload) => {
            effects.push({ kind, payload })
            return Promise.resolve(subject)
        },
        model: {
            text: () => Promise.resolve(String(replies.shift())),
            json: (schema) => Promise.resolve(schema.parse(replies.shift())),
        },
        now: () => new Date(0),
    }
}

/** The output and the effects of one example run, the output parsed by the node's own schema. */
export const runExample = async (
    node: NodeDefinition,
    example: AnyExample,
    options: ContextOptions = {},
): Promise<{ readonly output: unknown; readonly effects: ReadonlyArray<RecordedEffect> }> => {
    const effects: Array<RecordedEffect> = []
    const context = contextOfExample(node, example, effects, options)
    const output = node.output.parse(await node.run(node.input.parse(example.input), context))
    return { output, effects }
}

/** The effects an example expects, as kind and payload (a bare kind has no payload to compare). */
export const expectedEffects = (example: AnyExample): ReadonlyArray<RecordedEffect> =>
    example.effects.map((effect) =>
        typeof effect === "string"
            ? { kind: effect, payload: undefined }
            : { kind: effect.kind, payload: effect.payload },
    )
