import { z } from "zod"
import type { CallMeta, ChatMessage, NodeAsk } from "./ai-tasks.contracts"
import type { TaskSchema } from "./ai-tasks.schema"

/**
 * The JSON Schema of the answer a structured node call parses, as the model reads it: the members the zod schema accepts, with their
 * names, types and enum values. JSON mode alone tells the model only "an object", so without it the model guesses the member names.
 */
const answerSchemaOf = (schema: TaskSchema): string =>
    JSON.stringify(z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }))

/** The system message of a node's call: its instructions, followed by the JSON Schema its answer must match when it asks for JSON. */
const instructionsOf = (ask: NodeAsk, schema: TaskSchema | null): string =>
    schema === null
        ? ask.instructions
        : `${ask.instructions}\n\nAnswer with one JSON object that matches this JSON Schema exactly (member names, types and allowed values):\n${answerSchemaOf(schema)}`

/** The messages of a graph node's call: its instructions (with the answer's JSON Schema for a structured call), then its input as JSON. */
export const nodeMessagesOf = (ask: NodeAsk, schema: TaskSchema | null = null): ReadonlyArray<ChatMessage> => [
    { role: "system", content: instructionsOf(ask, schema) },
    {
        role: "user",
        content: JSON.stringify(ask.input ?? null),
        ...(ask.images === undefined || ask.images.length === 0 ? {} : { images: ask.images }),
    },
]

/** How a graph node's call is metered: engine work of the namespace its purpose starts with (`order` of `order.record:extract`). */
export const nodeMetaOf = (ask: NodeAsk): CallMeta => ({ kind: "engine", module: ask.purpose.split(".", 1).join("") })
