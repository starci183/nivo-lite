import type { CallMeta, ChatMessage, NodeAsk } from "./ai-tasks.contracts"

/** The messages of a graph node's call: its instructions, then its input as JSON. */
export const nodeMessagesOf = (ask: NodeAsk): ReadonlyArray<ChatMessage> => [
    { role: "system", content: ask.instructions },
    {
        role: "user",
        content: JSON.stringify(ask.input ?? null),
        ...(ask.images === undefined || ask.images.length === 0 ? {} : { images: ask.images }),
    },
]

/** How a graph node's call is metered: engine work of the namespace its purpose starts with (`order` of `order.record:extract`). */
export const nodeMetaOf = (ask: NodeAsk): CallMeta => ({ kind: "engine", module: ask.purpose.split(".", 1).join("") })
