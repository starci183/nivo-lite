import { McpGatewayError, McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import type {
    DiscoveredTool,
    GatewayConnectorManifest,
    GatewayToolSpec,
    NativeAdapter,
    ToolGrant,
} from "./mcp-gateway.contracts"

/** A full gateway tool name: `<connector>.<tool>`. */
const TOOL_NAME = /^([a-z][a-z0-9-]{1,30})\.([a-zA-Z][a-zA-Z0-9_.-]{1,80})$/u
/** The most tools one discovery answers. */
const SEARCH_MAX = 10

/** A full name split into its connector and the connector's own tool name. */
export interface ToolAddress {
    /** The connector key. */
    readonly connector: string
    /** The tool name inside the connector. */
    readonly tool: string
}

/** A full name split, or null when the text is not a full name. */
export type OptionalToolAddress = ToolAddress | null

/** Splits a full name; null when it is not one. */
export const addressOf = (name: string): OptionalToolAddress => {
    const match = TOOL_NAME.exec(name)
    const connector = match?.[1]
    const tool = match?.[2]
    return connector === undefined || tool === undefined ? null : { connector, tool }
}

/** The full name of a connector's tool. */
export const fullNameOf = (connector: string, tool: string): string => `${connector}.${tool}`

/** The full name of a tool of a manifest: its public prefix (`namespace`, else the key) and the tool's own name. */
export const toolNameOf = (manifest: Pick<GatewayConnectorManifest, "key" | "namespace">, tool: string): string =>
    fullNameOf(manifest.namespace ?? manifest.key, tool)

/** The prefix no wildcard grant may name alone: `nivo.*` would cover every native tool NIVO has. */
const BARE_WILDCARDS: ReadonlySet<string> = new Set(["nivo"])

/** The prefix a wildcard grant covers (`ledger.*` → `ledger`), or null for an exact grant or a refused bare `nivo.*`. */
const wildcardPrefixOf = (tool: string): string | null => {
    if (!tool.endsWith(".*")) return null
    const prefix = tool.slice(0, -2)
    return prefix === "" || BARE_WILDCARDS.has(prefix) ? null : prefix
}

/**
 * The grant that applies to a full name: the exact one, else the wildcard whose prefix is the LONGEST that covers the name
 * (`nivo.ledger.*` before `nivo.*`-like broader ones), else none. A bare `nivo.*` grant covers nothing.
 */
export const grantFor = (grants: ReadonlyArray<ToolGrant>, name: string): ToolGrant | null => {
    const exact = grants.find((grant) => grant.tool === name)
    if (exact !== undefined) return exact
    let best: ToolGrant | null = null
    let length = -1
    for (const grant of grants) {
        const prefix = wildcardPrefixOf(grant.tool)
        if (prefix !== null && name.startsWith(`${prefix}.`) && prefix.length > length) {
            best = grant
            length = prefix.length
        }
    }
    return best
}

/** One tool found by its full name: the manifest's connector entry and the spec. */
export interface NamedTool<C> {
    /** The connector entry that holds it. */
    readonly connector: C
    /** Its spec. */
    readonly spec: GatewayToolSpec
}

/**
 * The tool a full name stands for among connectors, through the index of every full name (a prefix may hold several connectors), or
 * null when none holds it.
 */
export const namedToolIn = <C extends { readonly manifest: GatewayConnectorManifest }>(
    connectors: ReadonlyArray<C>,
    name: string,
): NamedTool<C> | null => {
    for (const connector of connectors) {
        const spec = connector.manifest.tools.find((tool) => toolNameOf(connector.manifest, tool.name) === name)
        if (spec !== undefined) return { connector, spec }
    }
    return null
}

/** The full names two or more manifests hold: a wiring bug that refuses the app's start. */
export const duplicateNamesOf = (manifests: ReadonlyArray<GatewayConnectorManifest>): ReadonlyArray<string> => {
    const seen = new Set<string>()
    const twice = new Set<string>()
    for (const manifest of manifests) {
        for (const spec of manifest.tools) {
            const name = toolNameOf(manifest, spec.name)
            if (seen.has(name)) twice.add(name)
            seen.add(name)
        }
    }
    return [...twice].toSorted()
}

/** The tool spec a manifest has under a connector-local name, or null. */
export const specOf = (manifest: GatewayConnectorManifest, tool: string): GatewayToolSpec | null =>
    manifest.tools.find((spec) => spec.name === tool) ?? null

const tokensOf = (text: string): ReadonlyArray<string> =>
    text
        .replace(/([a-z])([A-Z])/gu, "$1 $2")
        .toLowerCase()
        .split(/[^a-z0-9]+/u)
        .filter((token) => token.length > 1)

/** How well a tool matches the query: name hits weigh twice the description hits. */
const scoreOf = (query: ReadonlyArray<string>, name: string, description: string): number => {
    const nameTokens = new Set(tokensOf(name))
    const descriptionTokens = new Set(tokensOf(description))
    return query.reduce(
        (sum, token) => sum + (nameTokens.has(token) ? 2 : 0) + (descriptionTokens.has(token) ? 1 : 0),
        0,
    )
}

/** A discovered tool with its rank. */
interface Ranked {
    /** The tool. */
    readonly tool: DiscoveredTool
    /** Its score. */
    readonly score: number
}

/**
 * The tools a caller may use that match a query, best first, at most ten: a never-granted tool is never listed, so an agent sees a
 * handful of tools however many connectors the workspace has. An empty query lists the granted tools in manifest order.
 */
export const searchTools = (
    manifests: ReadonlyArray<GatewayConnectorManifest>,
    grants: ReadonlyArray<ToolGrant>,
    query: string,
    limit: number,
): ReadonlyArray<DiscoveredTool> => {
    const terms = tokensOf(query)
    const ranked = manifests.flatMap((manifest) =>
        manifest.tools.flatMap((spec): ReadonlyArray<Ranked> => {
            const name = toolNameOf(manifest, spec.name)
            const mode = grantFor(grants, name)?.mode ?? "never"
            const score = terms.length === 0 ? 1 : scoreOf(terms, name, spec.description)
            if (mode === "never" || score === 0) return []
            return [{ tool: { name, description: spec.description, scope: spec.scope, mode }, score }]
        }),
    )
    return ranked
        .toSorted((a, b) => b.score - a.score)
        .slice(0, Math.max(1, Math.min(limit, SEARCH_MAX)))
        .map((entry) => entry.tool)
}

/**
 * The native adapters as given, refused when two of them hold one full name (`McpGatewayError Invalid` naming the first): a full name
 * is the address of one tool, and the app never starts with two.
 */
export const withUniqueNames = (adapters: ReadonlyArray<NativeAdapter>): ReadonlyArray<NativeAdapter> => {
    const [clash] = duplicateNamesOf(adapters.map((adapter) => adapter.manifest))
    if (clash !== undefined) throw new McpGatewayError({ code: McpGatewayErrorCode.Invalid, params: { tool: clash } })
    return adapters
}
