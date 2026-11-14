import type { ApiKeyRowView } from "@/modules/types"

/** The kind of a key as the contract writes it: an MCP key for AI clients, or a public API key. */
export type KeyKind = "mcp" | "public_api"

/** Why a working MCP key is suspended, as the contract writes it: its holder is no longer an owner or manager, or left the workspace. */
export type KeyInactiveReason = "holder_not_manager" | "holder_gone"

/** One key as the `apiKeys` read answers it (the fields of the contract's `ApiKeyType` the page uses). */
export interface ApiKeyWire {
    readonly id: string
    readonly name: string
    readonly prefix: string
    readonly kind: KeyKind
    readonly agentId: string | null
    readonly endpointUrl: string | null
    readonly holderId: string | null
    readonly holderName: string | null
    readonly createdAt: string
    readonly lastUsedAt: string | null
    readonly revokedAt: string | null
    readonly inactiveReason: KeyInactiveReason | null
}

/** The agents a key may be scoped to: the id and the name the member knows. */
export interface ApiKeyAgent {
    readonly id: string
    readonly name: string
}

/** The words a key row is made of; the connected hook fills them from the `developers` catalog. */
export interface ApiKeyWords {
    readonly kindMcp: string
    readonly kindPublicApi: string
    /** An MCP key without an agent: the whole workspace, with its holder's rights. */
    readonly scopeMcpWorkspace: string
    /** An MCP key with an agent: that agent's tools are added; the argument is the agent's name. */
    readonly scopeMcpAgent: (name: string) => string
    readonly scopeMcpAgentUnnamed: string
    /** A public API key without an agent: the workspace's front-door agent owns the conversations. */
    readonly scopeApiDefault: string
    /** A public API key with an agent: it owns the conversations opened through the API. */
    readonly scopeApiAgent: (name: string) => string
    readonly scopeApiAgentUnnamed: string
    readonly holder: (name: string) => string
    /** The words before the visible start of a key. */
    readonly prefix: string
    readonly created: (date: string) => string
    readonly lastUsed: (date: string) => string
    readonly neverUsed: string
    readonly active: string
    readonly revoked: string
    /** A key suspended because its holder is no longer an owner or manager (it works again when they are). */
    readonly inactiveHolderNotManager: string
    /** A key suspended because its holder left the workspace. */
    readonly inactiveHolderGone: string
}

/** The kind of a key in words. */
export const kindTextOf = (kind: KeyKind, words: ApiKeyWords): string =>
    kind === "mcp" ? words.kindMcp : words.kindPublicApi

/** The scope of a key in words, by its kind: an agent named on an MCP key adds that agent's tools; on a public key it owns the API conversations. */
export const scopeTextOf = (
    kind: KeyKind,
    agentId: string | null | undefined,
    agents: ReadonlyArray<ApiKeyAgent> | undefined,
    words: ApiKeyWords,
): string => {
    const isMcp = kind === "mcp"
    if (agentId === null || agentId === undefined || agentId === "")
        return isMcp ? words.scopeMcpWorkspace : words.scopeApiDefault
    const agent = agents?.find((one) => one.id === agentId)
    if (agent === undefined) return isMcp ? words.scopeMcpAgentUnnamed : words.scopeApiAgentUnnamed
    return isMcp ? words.scopeMcpAgent(agent.name) : words.scopeApiAgent(agent.name)
}

/** The state of a key in words: revoked is final, else suspended with its reason, else in use. */
const statusTextOf = (key: ApiKeyWire, words: ApiKeyWords): string => {
    if (key.revokedAt !== null) return words.revoked
    if (key.inactiveReason === "holder_not_manager") return words.inactiveHolderNotManager
    if (key.inactiveReason === "holder_gone") return words.inactiveHolderGone
    return words.active
}

/** One key row: its name, kind, scope, holder, prefix, dates and state; `date` formats an ISO time for the reader. */
export const apiKeyRowOf = (
    key: ApiKeyWire,
    agents: ReadonlyArray<ApiKeyAgent> | undefined,
    words: ApiKeyWords,
    date: (iso: string) => string,
): ApiKeyRowView => ({
    id: key.id,
    name: key.name,
    kindLabel: kindTextOf(key.kind, words),
    scopeText: scopeTextOf(key.kind, key.agentId, agents, words),
    prefixLead: words.prefix,
    prefixCode: `${key.prefix}…`,
    detailText: [
        words.created(date(key.createdAt)),
        ...(key.holderName === null ? [] : [words.holder(key.holderName)]),
        key.lastUsedAt === null ? words.neverUsed : words.lastUsed(date(key.lastUsedAt)),
    ].join(" · "),
    statusLabel: statusTextOf(key, words),
    isRevoked: key.revokedAt !== null,
    isInactive: key.revokedAt === null && key.inactiveReason !== null,
})

/** Where the MCP address stands: the API gave it, no key tells it yet, or the deployment publishes none. */
export type McpEndpointState =
    { readonly kind: "url"; readonly url: string } | { readonly kind: "no-key" } | { readonly kind: "unset" }

/**
 * The MCP address the API publishes (`endpointUrl` of an MCP key). With no MCP key there is nothing to read it from yet; with keys
 * that all answer null the deployment publishes no MCP route. Nothing is guessed.
 */
export const mcpEndpointStateOf = (keys: ReadonlyArray<Pick<ApiKeyWire, "kind" | "endpointUrl">>): McpEndpointState => {
    const mcp = keys.filter((key) => key.kind === "mcp")
    if (mcp.length === 0) return { kind: "no-key" }
    const url = mcp.find((key) => key.endpointUrl !== null && key.endpointUrl !== "")?.endpointUrl
    return url === undefined || url === null ? { kind: "unset" } : { kind: "url", url }
}

/** The placeholder the page shows where the secret will go. */
export const KEY_PLACEHOLDER = "<key>"

/** The one command that adds NIVO to Claude Code; `secret` fills the key, else the `<key>` placeholder stands. */
export const claudeCodeSnippetOf = (endpointUrl: string, secret?: string): string =>
    `claude mcp add --transport http nivo ${endpointUrl} --header "Authorization: Bearer ${secret ?? KEY_PLACEHOLDER}"`

/** The project file form (`.mcp.json`): the key stays in the environment as `NIVO_API_KEY`. */
export const mcpJsonSnippetOf = (endpointUrl: string): string =>
    JSON.stringify(
        {
            mcpServers: {
                nivo: { type: "http", url: endpointUrl, headers: { Authorization: "Bearer ${NIVO_API_KEY}" } },
            },
        },
        null,
        2,
    )

/** The shown-once state: nothing, or the secret that was just made. It lives in memory only and is dropped on dismiss. */
export type FreshKeyState =
    | { readonly kind: "none" }
    | {
          readonly kind: "shown"
          readonly secret: string
          readonly endpointUrl: string | null
          readonly keyKind: KeyKind
      }

/** Nothing is shown. */
export const FRESH_NONE: FreshKeyState = { kind: "none" }

/** The state after a key was created: the secret is shown, with the address and kind the API answered. */
export const freshShown = (secret: string, endpointUrl: string | null, keyKind: KeyKind): FreshKeyState => ({
    kind: "shown",
    secret,
    endpointUrl,
    keyKind,
})

/** The secret to draw, or `undefined` when nothing is shown. */
export const freshSecretOf = (state: FreshKeyState): string | undefined =>
    state.kind === "shown" ? state.secret : undefined
