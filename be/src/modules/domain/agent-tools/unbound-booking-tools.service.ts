import { Injectable } from "@nestjs/common"
import type { BookingToolName, JsonResult } from "./agent-tools.contracts"
import type { BookingTools } from "./agent-tools.port"
import { AgentToolsError, AgentToolsErrorCode } from "./errors/agent-tools.error"

@Injectable()
/** The booking tools of an app whose booking lane has not landed. */
export class UnboundBookingToolsService implements BookingTools {
    /** Refuses with the typed "tool unavailable" error. */
    run(_ctx: unknown, tool: BookingToolName): Promise<JsonResult> {
        return Promise.reject(new AgentToolsError({ code: AgentToolsErrorCode.ToolUnavailable, params: { tool } }))
    }
}
