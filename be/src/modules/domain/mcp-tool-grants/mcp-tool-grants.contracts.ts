/** How far an agent may use a tool: alone, after a person approves, or not at all (the default). */
export type GrantMode = "auto" | "ask" | "never"

/** A numeric argument constraint of a grant: the argument `arg` runs alone up to `max`. */
export interface ArgConstraint {
    /** The tool argument, for example "quantity" of shop.order.place. */
    readonly arg: string
    /** The largest value allowed without a person. */
    readonly max: number
}

/** One grant of a tool (its full name or `connector.*`) to an agent of a workspace. */
export interface McpToolGrantRecord {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent; it must be one of the workspace. */
    readonly agentId: string
    /** The full tool name or `connector.*`. */
    readonly tool: string
    /** The mode. */
    readonly mode: GrantMode
    /** The largest amount allowed alone, or null for none. */
    readonly limitVnd: number | null
    /** The argument constraints the call must keep to run alone. */
    readonly constraints: ReadonlyArray<ArgConstraint>
}

/** A grant a person sets in the console: the record and who set it. */
export interface McpToolGrantChange extends McpToolGrantRecord {
    /** The person who set it. */
    readonly updatedBy: string
}
