import type { DiscoveredTool, GatewayConnectorManifest, GatewayToolSpec, ToolGrant } from "./mcp-gateway.contracts"

/** A full gateway tool name: `<connector>.<tool>`. */
const TOOL_NAME = /^([a-z][a-z0-9-]{1,30})\.([a-zA-Z][a-zA-Z0-9_.]{1,80})$/u
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

/** The grant that applies to a full name: the exact one, else the connector wildcard, else none. */
export const grantFor = (grants: ReadonlyArray<ToolGrant>, name: string): ToolGrant | null => {
    const address = addressOf(name)
    if (address === null) return null
    const wildcard = `${address.connector}.*`
    return grants.find((grant) => grant.tool === name) ?? grants.find((grant) => grant.tool === wildcard) ?? null
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
            const name = fullNameOf(manifest.key, spec.name)
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
