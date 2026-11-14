import type { GraphSpec, NodeAccountLookup } from "@nivo-lite/agent-sdk/graph"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { PROVIDER_CATALOGUE, servesTool, type ProviderSpec } from "@modules/domain/tools"

// nivo-frame `rights` + `templates`: a node lists its PROVIDERS in priority order and declares ONE mode. The binding is a read of the
// agent's attachments (no row is written): readiness counts every attached account of a provider; a CALL acts on one, picked where it is
// needed (the event's account, the run's, the agent's default, else the typed `TOOLS_ACCOUNT_NEEDS_PICK`: tools `pickAccountOf`).

/** An operation a node may call, as far as its title needs it: the kind and the provider of its account, and its id. */
export interface TitledOperation {
    /** The kind of the account. */
    readonly kind: string
    /** The provider of the account, or null for any provider of the kind. */
    readonly provider: string | null
    /** The operation: a tool id, or the id of a work action. */
    readonly operation: string
}

/** The title of an operation in the owner's two languages. */
export interface OperationTitle {
    /** Vietnamese. */
    readonly vi: string
    /** English. */
    readonly en: string
}

/** The title of an operation, or null when nothing declares one. */
export type OptionalOperationTitle = OperationTitle | null

/** The title of an operation, read where it is declared: a tool by the label its plugin gives it. Null when nothing declares one: no title is made from an id. */
export const operationTitleOf = (asked: TitledOperation): OptionalOperationTitle => {
    const label = INSTALLED.toolLabelOf(asked.operation)
    return label === null ? null : { vi: label.title.vi, en: label.title.en }
}

/** True when a provider has the operation: a tool of one of its abilities. */
export const providerHolds = (spec: ProviderSpec, operation: string): boolean =>
    spec.abilities.some((ability) => ability.tools.includes(operation))

/**
 * What this host tells the graph check about accounts: a kind is known when a provider of the catalogue is of it (and the named provider,
 * when there is one, is of that kind). No operation is judged: a node account is a provider and an optional connection, and the node's
 * declared mode is the only mode.
 */
export const nodeAccountLookup: NodeAccountLookup = {
    knows: (kind, provider) =>
        PROVIDER_CATALOGUE.some((spec) => spec.kind === kind && (provider === null || spec.provider === provider)),
}

/**
 * One provider entry of a node, in either stored form: `@1` `{ kind, provider, connectionId }` (a connection pins one account; an older
 * entry may still carry a legacy `operations` map, of which only the tool NAMES are read, for a step nothing defines; its modes are never
 * read here), or a template step's provider key as the adapter carries it.
 */
export interface NodeAccountEntry {
    /** `@1` only: the kind of the account. */
    readonly kind?: string | undefined
    /** Legacy stored rows only: the tools an older entry listed (names only; the mode lives on the node). */
    readonly operations?: Readonly<Record<string, unknown>> | undefined
    /** The provider, or (`@1` only) null for any provider of the kind. */
    readonly provider: string | null
    /** `@1` only: the connected account the entry pins, or null. */
    readonly connectionId?: string | null | undefined
}

/** A node as the binding reads it: its key, the step it runs, and its provider entries in priority order. */
export interface BindableNode {
    /** The key of the node in its graph. */
    readonly key: string
    /** The node it runs, for its declared tools; absent for a control step. */
    readonly step?: string | undefined
    /** Its provider entries in priority order, or absent (it acts on no account). */
    readonly accounts?: ReadonlyArray<NodeAccountEntry> | undefined
}

/** One attachment of the agent: a connected account and its provider as nodes name it (tier 1). */
export interface AgentAttachment {
    /** The connected account. */
    readonly connectionId: string
    /** Its provider. */
    readonly provider: string
}

/** One provider of a node, in the node's order, with the tools the node may call through it. */
export interface NodeProvider {
    /** The provider. */
    readonly provider: string
    /** Its place in the node's list (0 = the first). */
    readonly position: number
    /** The tools, in the order the node declares them. */
    readonly operations: ReadonlyArray<string>
    /** The account a `@1` entry pins for it, or null. */
    readonly pinned: string | null
}

/** What the binding reads besides the nodes and the attachments. */
export interface BindOptions {
    /** The provider catalogue; the installed one by default. */
    readonly catalogue?: ReadonlyArray<ProviderSpec> | undefined
}

/**
 * The pseudo-provider of the engine's own tools: no account, always bound, never hides a graph. The same literal as the SDK's
 * `PROVIDER.nivo` (a template never lists it now; an older stored entry may).
 */
export const NIVO_PROVIDER = "nivo"

/** The tools a node declares (its template node's `tools`, else what an installed step lists); none for a step nothing defines. */
const toolsOfStep = (step: string | undefined): ReadonlyArray<string> => {
    if (step === undefined) return []
    const template = INSTALLED.templateNodeOf(step)
    if (template?.entry === "template-node") return template.tools
    return INSTALLED.stepOf(step)?.tools ?? []
}

/**
 * The providers one entry names, in order: its own provider; for a `@1` entry of any provider of a kind, every provider of the catalogue
 * of that kind.
 */
const providersOfEntry = (entry: NodeAccountEntry, catalogue: ReadonlyArray<ProviderSpec>): ReadonlyArray<string> =>
    entry.provider !== null
        ? [entry.provider]
        : catalogue.filter((spec) => spec.kind === entry.kind).map((spec) => spec.provider)

/**
 * A node's providers in its order, each once, with the tools the node may call through it (the node's declared tools the provider
 * serves: `servesTool`; a legacy entry's listed tool names only for a step nothing defines) and the account a `@1` entry pins. A provider that serves none of them is left
 * out; a node with no `accounts` has none.
 */
export const nodeProvidersOf = (node: BindableNode, options: BindOptions = {}): ReadonlyArray<NodeProvider> => {
    const catalogue = options.catalogue ?? PROVIDER_CATALOGUE
    const declared = toolsOfStep(node.step)
    const found = new Map<string, { readonly operations: Set<string>; readonly pinned: string | null }>()
    for (const entry of node.accounts ?? []) {
        for (const provider of providersOfEntry(entry, catalogue)) {
            // The node's declared tools the provider serves; a legacy entry's own tool names only for a step nothing defines.
            const listed =
                declared.length > 0 || entry.operations === undefined
                    ? declared.filter((tool) => servesTool(provider, provider, tool))
                    : Object.keys(entry.operations)
            if (listed.length === 0) continue
            const kept = found.get(provider) ?? { operations: new Set<string>(), pinned: null }
            for (const tool of listed) kept.operations.add(tool)
            found.set(provider, { operations: kept.operations, pinned: kept.pinned ?? entry.connectionId ?? null })
        }
    }
    return [...found.entries()].map(([provider, kept], position) => ({
        provider,
        position,
        operations: [...kept.operations],
        pinned: kept.pinned,
    }))
}

/** A record placed on a node's account, as the old row writers hold it (kept for their shape; nothing writes rows now). */
interface PlacedRecord {
    readonly workflowId: string
    readonly nodeKey: string
    readonly connectionId: string
    readonly position?: number | undefined
}

/** The graph a workflow runs, as the placing of records reads it. */
export interface PlacedGraph {
    /** The nodes of the graph. */
    readonly nodes: ReadonlyArray<BindableNode>
}

/**
 * The records with their `position`: the provider's place in the node's list, read from the graph each workflow runs and the provider of
 * each record's account. A record it cannot place is handed back as it is.
 */
export const positionedOf = <R extends PlacedRecord>(
    records: ReadonlyArray<R>,
    graphOf: (workflowId: string) => PlacedGraph | undefined,
    attachments: ReadonlyArray<AgentAttachment>,
): ReadonlyArray<R> => {
    const providerOf = new Map(attachments.map((attachment) => [attachment.connectionId, attachment.provider]))
    return records.map((record) => {
        const provider = providerOf.get(record.connectionId)
        const node = graphOf(record.workflowId)?.nodes.find((candidate) => candidate.key === record.nodeKey)
        if (provider === undefined || node === undefined) return record
        const position = nodeProvidersOf(node).find((one) => one.provider === provider)?.position ?? 0
        return position === (record.position ?? 0) ? record : { ...record, position }
    })
}

/** The graphs active workflows run, as the placing of records reads them. */
export const placedGraphsOf = (
    graphs: ReadonlyArray<{ readonly workflowId: string; readonly graph: Pick<GraphSpec, "nodes"> }>,
): ((workflowId: string) => PlacedGraph | undefined) => {
    const placed = new Map(
        graphs.map((active): [string, PlacedGraph] => [active.workflowId, { nodes: active.graph.nodes }]),
    )
    return (workflowId) => placed.get(workflowId)
}
