import type { NodeIndex } from "../node"
import type { GraphNodeAccountMode, GraphSpecNode, GraphSpecProblem } from "./graph-spec.types"

/**
 * What only the host knows about accounts: its account kinds with their providers. A node account is a provider and an optional
 * connection; the mode lives on the node, so no operation is judged here.
 */
export interface NodeAccountLookup {
    /** True for a kind the host knows and, when a provider is named, a provider of that kind. */
    readonly knows: (kind: string, provider: string | null) => boolean
}

/** One operation a node asks to call on one account: a row of the version's request. */
export interface NodeAccountRequest {
    /** The key of the node in its graph. */
    readonly nodeKey: string
    /** The kind of the account. */
    readonly kind: string
    /** The provider of the account, or null for any provider of the kind. */
    readonly provider: string | null
    /** The connected account, or null while it is not bound. */
    readonly connectionId: string | null
    /** The operation, by tool id. */
    readonly operation: string
    /** How the node asks to call it. */
    readonly mode: GraphNodeAccountMode
}

/** A node as the request reads it: its key and the accounts it asks for. */
type AccountedNode = Pick<GraphSpecNode, "key" | "accounts">

/**
 * The request of a graph's nodes as rows, one per node, account and operation, in the order they are written. A node with no
 * `accounts` gives none: it asks for exactly what the workspace granted it, which only the host can read.
 */
export const nodeAccountRequestsOf = (nodes: ReadonlyArray<AccountedNode>): ReadonlyArray<NodeAccountRequest> =>
    nodes.flatMap((node) =>
        (node.accounts ?? []).flatMap((account) =>
            Object.entries(account.operations ?? {}).map(([operation, mode]): NodeAccountRequest => ({
                nodeKey: node.key,
                kind: account.kind,
                provider: account.provider,
                connectionId: account.connectionId,
                operation,
                mode,
            })),
        ),
    )

/** What tells two account entries of one node apart: the kind, the provider and the connection. */
const identityOf = (account: {
    readonly kind: string
    readonly provider: string | null
    readonly connectionId: string | null
}) => JSON.stringify([account.kind, account.provider, account.connectionId])

/** The problems of one node's accounts; `at` is `<nodeKey>.accounts.<index>`. */
const problemsOfNode = (node: GraphSpecNode, host: NodeAccountLookup | undefined): ReadonlyArray<GraphSpecProblem> => {
    const accounts = node.accounts ?? []
    const identities = accounts.map((account) => identityOf(account))
    return accounts.flatMap((account, position): ReadonlyArray<GraphSpecProblem> => {
        const at = `${node.key}.accounts.${position}`
        return [
            ...(identities.indexOf(identityOf(account)) === position
                ? []
                : [{ code: "NODE_ACCOUNT_DUPLICATE" as const, at }]),
            ...(host === undefined || host.knows(account.kind, account.provider)
                ? []
                : [{ code: "NODE_ACCOUNT_KIND_UNKNOWN" as const, at }]),
        ]
    })
}

/**
 * The problems of the accounts the nodes of a graph ask for: two entries for one account and, when the host told what it knows, an
 * unknown kind or provider. No operation is judged (the node's declared mode is the only mode; what it may call is fixed by its code).
 * A graph whose nodes carry no `accounts` has none. `_index` is kept for the callers; it is no longer read.
 */
export const nodeAccountProblems = (
    nodes: ReadonlyArray<GraphSpecNode>,
    _index: NodeIndex,
    host?: NodeAccountLookup,
): ReadonlyArray<GraphSpecProblem> => nodes.flatMap((node) => problemsOfNode(node, host))
