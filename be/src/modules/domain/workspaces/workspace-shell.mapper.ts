import type { ShellAgent, ShellApproval, ShellException, ShellFacts } from "./workspaces.contracts"

type JsonRecord = { readonly [key: string]: unknown }

const isRecord = (value: unknown): value is JsonRecord =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const text = (value: unknown): string | null => (typeof value === "string" ? value : null)

const count = (value: unknown): number => (typeof value === "number" ? value : 0)

const rows = (value: unknown): ReadonlyArray<JsonRecord> => (Array.isArray(value) ? value.filter(isRecord) : [])

const agentFrom = (row: JsonRecord): ShellAgent => ({
    id: text(row.id) ?? "",
    name: text(row.name) ?? "",
    module: text(row.module) ?? "",
    status: row.status === "paused" ? "paused" : "active",
})

const approvalFrom = (row: JsonRecord): ShellApproval => ({
    id: text(row.id) ?? "",
    draft: text(row.draft) ?? "",
    nextAction: text(row.next_action),
    leadId: text(row.lead_id),
    contactName: text(row.contact_name),
})

const exceptionFrom = (row: JsonRecord): ShellException => ({
    id: text(row.id) ?? "",
    leadId: text(row.lead_id),
    contactName: text(row.contact_name),
    summary: text(row.summary),
    error: text(row.error),
})

/** Maps the JSON the `shell_data` function returns into typed facts; an answer that is not an object reads as empty. */
export const toShellFacts = (json: unknown): ShellFacts => {
    const data: JsonRecord = isRecord(json) ? json : {}
    return {
        leadCount: count(data.lead_count),
        openResponsibilityCount: count(data.open_responsibility_count),
        agents: rows(data.agents).map(agentFrom),
        hasChatbot: data.has_chatbot === true,
        isFoundingMember: data.is_founding_member === true,
        approvals: rows(data.pending).map(approvalFrom),
        exceptions: rows(data.exceptions).map(exceptionFrom),
        pendingDecisions: count(data.pending_decisions),
    }
}
