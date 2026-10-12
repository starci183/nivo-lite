import type { Json } from "../../../../../../../supabase/types/database.types"

/** One installed agent, as the console menus draw it. */
export type ShellAgent = {
    readonly id: string
    readonly name: string
    readonly module: string
    readonly status: "active" | "paused"
}

/** One draft waiting for approval. */
export type ShellApproval = {
    readonly id: string
    readonly draft: string
    readonly nextAction: string | null
    readonly leadId: string | null
    readonly contactName: string | null
}

/** One exception with no approval card of its own. */
export type ShellException = {
    readonly id: string
    readonly leadId: string | null
    readonly contactName: string | null
    readonly summary: string | null
    readonly error: string | null
}

/** The counts and lists the console frame needs from the `shell_data` function. */
export type ShellFacts = {
    readonly leadCount: number
    readonly openResponsibilityCount: number
    readonly agents: ReadonlyArray<ShellAgent>
    readonly hasChatbot: boolean
    readonly isFoundingMember: boolean
    readonly approvals: ReadonlyArray<ShellApproval>
    readonly exceptions: ReadonlyArray<ShellException>
    readonly pendingDecisions: number
}

type JsonRecord = { readonly [key: string]: Json | undefined }

const isRecord = (value: Json | undefined): value is JsonRecord =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const text = (value: Json | undefined): string | null => (typeof value === "string" ? value : null)

const count = (value: Json | undefined): number => (typeof value === "number" ? value : 0)

const rows = (value: Json | undefined): ReadonlyArray<JsonRecord> =>
    Array.isArray(value) ? value.filter(isRecord) : []

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

/** Maps the JSON the `shell_data` function returns into typed facts; null when it is not an object. */
export const shellFromJson = (json: Json): ShellFacts | null => {
    if (!isRecord(json)) return null
    return {
        leadCount: count(json.lead_count),
        openResponsibilityCount: count(json.open_responsibility_count),
        agents: rows(json.agents).map(agentFrom),
        hasChatbot: json.has_chatbot === true,
        isFoundingMember: json.is_founding_member === true,
        approvals: rows(json.pending).map(approvalFrom),
        exceptions: rows(json.exceptions).map(exceptionFrom),
        pendingDecisions: count(json.pending_decisions),
    }
}
