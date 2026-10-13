import type { OptionalAuthorization, ToolArgs } from "@modules/domain/agent-tools"
/** What run tool takes. */
export interface RunToolRequest {
    /** The Authorization header: the short-lived tool token of the OpenClaw turn as bearer. */
    readonly authorization: OptionalAuthorization
    /** The dotted tool name. */
    readonly tool: string
    /** The arguments the agent sent; clipped by the tool policy. */
    readonly args: ToolArgs
}
