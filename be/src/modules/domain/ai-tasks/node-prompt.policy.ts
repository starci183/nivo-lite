import type { CallMeta, ChatMessage, NodeAsk } from "./ai-tasks.contracts"
import type { TaskSchema } from "./ai-tasks.schema"

/**
 * The JSON Schema of the answer a structured node call parses, as the model reads it: the members the zod schema accepts, with their
 * names, types and enum values. JSON mode alone tells the model only "an object", so without it the model guesses the member names.
 */
const answerSchemaOf = (schema: TaskSchema): string =>
    JSON.stringify(schema.toJSONSchema({ io: "input", unrepresentable: "any" }))

/** The system message of a node's call: its instructions, followed by the JSON Schema its answer must match when it asks for JSON. */
const instructionsOf = (ask: NodeAsk, schema: TaskSchema | null): string =>
    schema === null
        ? ask.instructions
        : `${ask.instructions}\n\nAnswer with one JSON object that matches this JSON Schema exactly (member names, types and allowed values):\n${answerSchemaOf(schema)}`

/**
 * The two parts of a graph node's call, for the provider's prompt cache. `stable` is the prefix a provider caches: the node's
 * instructions (the agent's craft and tool set, the shop's policy values, the step) with the answer's JSON Schema for a structured
 * call; it is the same text, byte for byte, for the same agent, shop and step. `volatile` is what changes from call to call: the
 * words that hold for this call only, then the input as JSON (with the pictures).
 */
export interface NodePrompt {
    /** The stable part: one system message. THE END OF THE STABLE PART is the end of this list. */
    readonly stable: ReadonlyArray<ChatMessage>
    /** The volatile part, sent after the stable one. */
    readonly volatile: ReadonlyArray<ChatMessage>
}

/** A graph node's call laid out stable part first. A model that takes cache markers gets its marker at the end of `stable`, nowhere else. */
export const nodePromptOf = (ask: NodeAsk, schema: TaskSchema | null = null): NodePrompt => {
    const words = (ask.volatile ?? "").trim()
    return {
        stable: [{ role: "system", content: instructionsOf(ask, schema) }],
        volatile: [
            ...(words === "" ? [] : [{ role: "system" as const, content: words }]),
            {
                role: "user",
                content: JSON.stringify(ask.input ?? null),
                ...(ask.images === undefined || ask.images.length === 0 ? {} : { images: ask.images }),
            },
        ],
    }
}

/** The messages of a graph node's call: the stable part (instructions, answer schema), then the volatile one (this call's words, the input as JSON). */
export const nodeMessagesOf = (ask: NodeAsk, schema: TaskSchema | null = null): ReadonlyArray<ChatMessage> => {
    const prompt = nodePromptOf(ask, schema)
    return [...prompt.stable, ...prompt.volatile]
}

/** How a graph node's call is metered: engine work of the namespace its purpose starts with (`order` of `order.record:extract`). */
export const nodeMetaOf = (ask: NodeAsk): CallMeta => ({ kind: "engine", module: ask.purpose.split(".", 1).join("") })
