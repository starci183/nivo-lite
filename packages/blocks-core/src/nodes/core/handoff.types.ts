import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { RecordRef } from "../node-schema.types"

/** The per-graph settings of the hand-off. */
export interface HandoffParams {
    /** The key of the agent to tag, as the module JSON names it. */
    readonly toModuleKey: string
    /** `chat` shows the hand-off as a tag in the conversation; `redirect` is a silent direct hand-off. */
    readonly visibility: HandoffVisibility
}

/** How a hand-off shows. */
export type HandoffVisibility = "chat" | "redirect"

/** The params as a graph spec writes them: the visibility may be left out. */
export interface HandoffParamsIn {
    /** The key of the agent to tag. */
    readonly toModuleKey: string
    /** How the hand-off shows; `chat` when left out. */
    readonly visibility?: HandoffVisibility | undefined
}

/** What the tagged agent is told. */
export interface HandoffInput {
    /** The note: why the conversation goes there. */
    readonly text: string
    /** The customer the hand-off is about, or null. */
    readonly leadId: string | null
    /** The channel the conversation runs on, or null. */
    readonly channel: string | null
    /** The conversation the tagged agent takes over, or null. */
    readonly conversationId: string | null
    /** The facts of the turn the agent needs, or null. */
    readonly context: Readonly<Record<string, JsonValue>> | null
}

/** Whom the node tagged. */
export interface HandoffOutput {
    /** The key of the agent tagged. */
    readonly toModuleKey: string
    /** The tag the host recorded. */
    readonly tag: RecordRef
}
