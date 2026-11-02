import type { AuthorityOutputStep } from "@modules/domain/authority-rules"
import type { GatewayCallResult } from "./mcp-gateway.contracts"

/** What one finished call came to, as an output keeps it: the masked summary the audit keeps, never the raw answer. */
export const outputStepOf = (tool: string, result: GatewayCallResult): AuthorityOutputStep => {
    if (result.ok) return { tool, status: "ok", code: null, summary: result.summary ?? "" }
    if (result.code === "approval_required") return { tool, status: "held", code: result.reason, summary: "" }
    return { tool, status: "failed", code: result.code, summary: result.detail }
}
