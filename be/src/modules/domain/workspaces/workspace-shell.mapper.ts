import type { ShellAgent, ShellFacts } from "./workspaces.contracts"

type JsonRecord = { readonly [key: string]: unknown }

const isRecord = (value: unknown): value is JsonRecord =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const text = (value: unknown): string | null => (typeof value === "string" ? value : null)

const rows = (value: unknown): ReadonlyArray<JsonRecord> => (Array.isArray(value) ? value.filter(isRecord) : [])

const agentFrom = (row: JsonRecord): ShellAgent => ({
    id: text(row.id) ?? "",
    name: text(row.name) ?? "",
    module: text(row.module) ?? "",
    status: row.status === "paused" ? "paused" : "active",
})

/** Maps the JSON the `shell_data` function returns into typed facts; an answer that is not an object reads as empty. */
export const toShellFacts = (json: unknown): ShellFacts => {
    const data: JsonRecord = isRecord(json) ? json : {}
    return {
        agents: rows(data.agents).map((row) => agentFrom(row)),
        hasChatbot: data.has_chatbot === true,
        isFoundingMember: data.is_founding_member === true,
    }
}
