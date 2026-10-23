import type { RuleMode } from "@modules/domain/authority-rules"

/** One agent a profile keeps, as the agents owner writes it. Owned by the agents capability (table agents). */
export interface SeedAgent {
    /** The workspace. */
    readonly workspaceId: string
    /** The module (agent type). */
    readonly module: string
    /** The display name. */
    readonly name: string
    /** The @handle; the key. */
    readonly handle: string
    /** The one-line role. */
    readonly role: string
    /** The owner-facing instructions. */
    readonly instructions: string
}

/** The agents owner: keeps an agent by its handle and answers its id. */
export interface SeedAgentRecords {
    /** Inserts the agent or updates the one with its handle; answers the agent id. */
    ensureByHandle(agent: SeedAgent): Promise<string>
}

/** One workspace document a profile keeps. Owned by the knowledge-sources capability (table knowledge_sources). */
export interface SeedSource {
    /** The workspace. */
    readonly workspaceId: string
    /** The workspace owner, recorded as the creator. */
    readonly ownerId: string
    /** The origin that marks the profile's own documents. */
    readonly origin: string
    /** The title; the key together with the origin. */
    readonly title: string
    /** The topic label. */
    readonly topic: string
    /** The module that reads it; null = every module. */
    readonly module: string | null
    /** Who may read it. */
    readonly visibility: "public" | "internal"
    /** The markdown text. */
    readonly content: string
}

/** What keeping one document did. */
export type SeedSourceOutcome = "inserted" | "requeued" | "unchanged"

/** The knowledge-sources owner: keeps a text document and queues its indexing when it is new or changed. */
export interface SeedSources {
    /** Adds, re-queues or leaves one document. */
    keep(source: SeedSource): Promise<SeedSourceOutcome>
}

/** One argument bound of a tool grant: the call needs approval above `max`. */
export interface SeedArgConstraint {
    /** The argument name of the tool's input schema. */
    readonly arg: string
    /** The largest value allowed alone. */
    readonly max: number
}

/** One MCP gateway tool granted to an agent. Owned by the mcp-tool-grants capability (table mcp_tool_grants). */
export interface SeedToolGrant {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The full tool name or `<connector>.*`. */
    readonly tool: string
    /** auto, ask or never. */
    readonly mode: RuleMode
    /** Amount at or above which the call needs approval, VND; null for none. */
    readonly limitVnd: number | null
    /** The argument bounds; empty for none. */
    readonly constraints: ReadonlyArray<SeedArgConstraint>
}

/** The tool grants owner: upserts grants by agent and tool and answers how many it wrote. */
export interface SeedToolGrants {
    /** Inserts or updates every grant (key: agent and tool); answers the count written. */
    upsert(grants: ReadonlyArray<SeedToolGrant>): Promise<number>
}

/** Who writes as the workspace owner in the gateway console. */
export interface SeedActor {
    /** The authenticated owner. */
    readonly principalId: string
    /** The workspace. */
    readonly workspaceId: string
}

/** A remote MCP connector to register: its endpoint and whether it takes a credential, never the value (set in the console). */
export interface SeedConnectorInput {
    /** The namespace key. */
    readonly key: string
    /** The display name. */
    readonly name: string
    /** The Streamable HTTP endpoint. */
    readonly url: string
    /** True when the server takes a bearer credential; until one is entered in the console the connector is `needed`. */
    readonly needsCredential: boolean
    /** The contract version. */
    readonly contractVersion: string
}

/** One tool of a connector as the console lists it. */
export interface SeedConnectorTool {
    /** True when the tool may run: its live schema is the approved one. */
    readonly approved: boolean
}

/** A connector as the console lists it, after a registration read its catalog. */
export interface SeedConnectorView {
    /** The namespace key. */
    readonly key: string
    /** `active` after a good catalog read; any other status means the server was not read. */
    readonly status: string
    /** `needed` while the server takes a credential no one entered yet (its catalog is then not read); else `none` or `set`. */
    readonly credentialState: string
    /** When an owner or manager approved its catalog, or null. */
    readonly approvedAt: string | null
    /** Its tools from the pinned catalog. */
    readonly tools: ReadonlyArray<SeedConnectorTool>
}

/**
 * The gateway console owner of the connectors: registers a remote connector (reading and pinning its live catalog) and lists the
 * connectors. Approving a catalog stays a person's step in the console, after reviewing the tool list.
 */
export interface SeedConnectors {
    /** Registers or updates the connector and stores the live catalog it reads; an unreachable server leaves it degraded. */
    registerRemote(actor: SeedActor, input: SeedConnectorInput): Promise<void>
    /** The connectors of the workspace with their tools. */
    connectors(actor: SeedActor): Promise<ReadonlyArray<SeedConnectorView>>
}
