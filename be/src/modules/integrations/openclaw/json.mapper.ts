import type { AgentEntry, JsonObject } from "./openclaw.contracts"

/** True for a JSON object: not null, not an array. */
export const isJsonObject = (value: unknown): value is JsonObject =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** True for an agent entry of `agents.list`: an object with a string id. */
export const isAgentEntry = (value: unknown): value is AgentEntry => isJsonObject(value) && typeof value.id === "string"

/** The `agents.list` array of an openclaw.json document; empty when there is none. */
export const agentListOf = (config: JsonObject): ReadonlyArray<unknown> => {
    const agents = isJsonObject(config.agents) ? config.agents : {}
    return Array.isArray(agents.list) ? agents.list : []
}

/** The `agents` object of an openclaw.json document; empty when there is none. */
export const agentsOf = (config: JsonObject): JsonObject => (isJsonObject(config.agents) ? config.agents : {})

/** True when the document marks an entry as the default agent, or already holds the implicit `main` agent. */
export const hasDefaultAgent = (list: ReadonlyArray<unknown>): boolean =>
    list.some((entry) => isJsonObject(entry) && (entry.default === true || entry.id === "main"))
