import { SdkError } from "../sdk-error"

/** Thrown when a node calls a NIVO MCP tool it did not declare. */
export class ToolUndeclaredError extends SdkError {
    readonly tool: string

    constructor(tool: string) {
        super("TOOL_UNDECLARED", `TOOL_UNDECLARED: ${tool}`)
        this.name = "ToolUndeclaredError"
        this.tool = tool
    }
}
