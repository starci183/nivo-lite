import { DomainError } from "@starci/common"

/** Thrown when a node calls a NIVO MCP tool it did not declare. */
export class ToolUndeclaredError extends DomainError<"TOOL_UNDECLARED"> {
    /** The id of the tool the node called without declaring it. */
    readonly tool: string

    constructor(tool: string) {
        super({ code: "TOOL_UNDECLARED", params: { at: tool } })
        this.tool = tool
    }
}
