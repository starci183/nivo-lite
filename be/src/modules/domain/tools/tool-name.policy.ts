import { isCrmOp } from "@nivo-lite/agent-sdk/schema"
import { ToolsError, ToolsErrorCode } from "./errors/tools.error"
import type {
    ToolManifest,
    ManifestTool,
    NativeToolFamily,
    ToolGrant,
} from "./tools.contracts"

/** A full gateway tool name: `<connector>.<tool>`. */
const TOOL_NAME = /^([a-z][a-z0-9-]{1,30})\.([a-zA-Z][a-zA-Z0-9_.-]{1,80})$/u

/** The first segment of every name of NIVO's own. */
const NIVO = "nivo"

/**
 * The level of NIVO's names a tool lives at: every tool an agent calls reads `nivo.tool.<1–4 segments>` (the name law of the agent SDK);
 * `nivo.api.*` and `nivo.trigger.*` are other levels and never a tool.
 */
export const NIVO_TOOL_PREFIX = "nivo.tool"

/** The tool part of a name of NIVO's own: the level `tool` and one to four kebab-case segments. */
const NIVO_TOOL_PART = /^tool(\.[a-z][a-z0-9-]*){1,4}$/u
/** A full name split into its connector and the connector's own tool name. */
export interface ToolAddress {
    /** The connector key. */
    readonly connector: string
    /** The tool name inside the connector. */
    readonly tool: string
}

/** A full name split, or null when the text is not a full name. */
export type OptionalToolAddress = ToolAddress | null

/**
 * Splits a full name; null when it is not one. A name of NIVO's own (`nivo.…`) is a tool name only at the tool level
 * (`nivo.tool.customer.message.send`): `nivo.api.*`, `nivo.trigger.*` and any other `nivo.tool.<rest>` are refused.
 */
export const addressOf = (name: string): OptionalToolAddress => {
    const match = TOOL_NAME.exec(name)
    const connector = match?.[1]
    const tool = match?.[2]
    if (connector === undefined || tool === undefined) return null
    // A CRM operation (`nivo.api.crm.<crmId>.<method>.<path>`, owner chốt 2026-11-13) is the one `nivo.api.*` name a node calls.
    return connector === NIVO && !NIVO_TOOL_PART.test(tool) && !isCrmOp(name) ? null : { connector, tool }
}

/** The full name of a connector's tool. */
export const fullNameOf = (connector: string, tool: string): string => `${connector}.${tool}`

/** The full name of a tool of a manifest: its public prefix (`namespace`, else the key) and the tool's own name. */
export const toolNameOf = (manifest: Pick<ToolManifest, "key" | "namespace">, tool: string): string =>
    fullNameOf(manifest.namespace ?? manifest.key, tool)

/** The prefixes no wildcard grant may name alone: `nivo.*` and `nivo.tool.*` would each cover every native tool NIVO has. */
export const BARE_WILDCARDS: ReadonlySet<string> = new Set([NIVO, NIVO_TOOL_PREFIX])

/** True for a wildcard grant no one may give: a bare `nivo.*` or `nivo.tool.*`. */
export const isBareWildcard = (tool: string): boolean => tool.endsWith(".*") && BARE_WILDCARDS.has(tool.slice(0, -2))

/**
 * The prefix a wildcard grant covers (`nivo.tool.ledger.*` → `nivo.tool.ledger`), or null for an exact grant or a refused bare
 * `nivo.*` / `nivo.tool.*`.
 */
const wildcardPrefixOf = (tool: string): string | null => {
    if (!tool.endsWith(".*")) return null
    const prefix = tool.slice(0, -2)
    return prefix === "" || BARE_WILDCARDS.has(prefix) ? null : prefix
}

/**
 * The grant that applies to a full name: the exact one, else the wildcard whose prefix is the LONGEST that covers the name
 * (`nivo.tool.ledger.entry.*` before `nivo.tool.ledger.*`), else none. A bare `nivo.*` or `nivo.tool.*` grant covers nothing.
 */
export const grantFor = <G extends Pick<ToolGrant, "tool">>(grants: ReadonlyArray<G>, name: string): G | null => {
    const exact = grants.find((grant) => grant.tool === name)
    if (exact !== undefined) return exact
    let best: G | null = null
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
    readonly spec: ManifestTool
}

/**
 * The tool a full name stands for among connectors, through the index of every full name (a prefix may hold several connectors), or
 * null when none holds it.
 */
export const namedToolIn = <C extends { readonly manifest: ToolManifest }>(
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
export const duplicateNamesOf = (manifests: ReadonlyArray<ToolManifest>): ReadonlyArray<string> => {
    const seen = new Set<string>()
    const twice = new Set<string>()
    for (const manifest of manifests) {
        for (const spec of manifest.tools) {
            const name = toolNameOf(manifest, spec.name)
            if (seen.has(name)) twice.add(name)
            seen.add(name)
        }
    }
    return [...twice].toSorted((a, b) => Number(a > b) - Number(a < b))
}

/** The tool spec a manifest has under a connector-local name, or null. */
export const specOf = (manifest: ToolManifest, tool: string): ManifestTool | null =>
    manifest.tools.find((spec) => spec.name === tool) ?? null

/**
 * The native adapters as given, refused when two of them hold one full name (`ToolsError Invalid` naming the first): a full name
 * is the address of one tool, and the app never starts with two.
 */
export const withUniqueNames = (adapters: ReadonlyArray<NativeToolFamily>): ReadonlyArray<NativeToolFamily> => {
    const [clash] = duplicateNamesOf(adapters.map((adapter) => adapter.manifest))
    if (clash !== undefined) throw new ToolsError({ code: ToolsErrorCode.Invalid, params: { tool: clash } })
    return adapters
}
