/** A value of the context a hand-off carries. */
export type ContextValue = string | number | boolean | null

/** The per-graph settings of the hand-off. */
export interface HandoffParams {
    /** The key of the agent to tag, as the module JSON names it. */
    readonly toModuleKey: string
}

/** What the tagged agent is told. */
export interface HandoffInput {
    /** The note: why the conversation goes there. */
    readonly text: string
    /** The conversation the tagged agent takes over, or null. */
    readonly conversationId: string | null
    /** The facts of the turn the agent needs, or null. */
    readonly context: Readonly<Record<string, ContextValue>> | null
}

/** Whom the node tagged. */
export interface HandoffOutput {
    /** The key of the agent tagged. */
    readonly toModuleKey: string
    /** The tag the host recorded. */
    readonly tag: { readonly kind: string; readonly id: string }
}
