import { Injectable } from "@nestjs/common"
import type { LeadWriteResult } from "./agent-tools.contracts"
import type { LeadWriter } from "./agent-tools.port"
import { AgentToolsError, AgentToolsErrorCode } from "./errors/agent-tools.error"

@Injectable()
/** The lead tool of an app whose leads side has not landed; saying a lead was saved when it was not would lie to the agent. */
export class UnboundLeadWriterService implements LeadWriter {
    /** Refuses with the typed "tool unavailable" error. */
    createOrUpdate(): Promise<LeadWriteResult> {
        return Promise.reject(
            new AgentToolsError({
                code: AgentToolsErrorCode.ToolUnavailable,
                params: { tool: "lead.create_or_update" },
            }),
        )
    }
}
