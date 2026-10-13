import { Injectable } from "@nestjs/common"
import type { HandoffTool } from "./agent-tools.port"
import { AgentToolsError, AgentToolsErrorCode } from "./errors/agent-tools.error"

@Injectable()
/** The handoff tool of an app whose channels lane has not landed. */
export class UnboundHandoffToolService implements HandoffTool {
    /** Refuses with the typed "tool unavailable" error. */
    handoff(): Promise<void> {
        return Promise.reject(
            new AgentToolsError({ code: AgentToolsErrorCode.ToolUnavailable, params: { tool: "handoff.to_person" } }),
        )
    }
}
