import type { GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { bindNodeProviders, isNodeMode, servesTool } from "@modules/domain/tools"
import type { ProviderAttachmentView } from "@modules/domain/tool-grants"
import { INSTALLED } from "@modules/domain/installed-plugins"

// nivo-frame `rights`: the publish / install GATE ("a version asking more rights needs the owner's yes") is REMOVED. What is left here is
// the shape the publish paths still carry (a settlement that grants nothing) and the read of what a running node stands on: its ONE
// declared mode, on the accounts its providers bind.

/** How a node's calls run: by themselves, or only after a person approved them. */
export type RightMode = "auto" | "ask"

/** One operation a node may call on one connected account, in the node's mode. */
export interface RightEntry {
    /** The key of the node in its graph. */
    readonly nodeKey: string
    /** The connected account. */
    readonly connectionId: string
    /** The operation, by tool id. */
    readonly operation: string
    /** The node's mode. */
    readonly mode: RightMode
}

/** An entry an old refusal listed (kept for the shape of old answers; nothing produces one). */
export interface AddedRight extends RightEntry {
    /** True when the entry would have loosened a mode an earlier one held. */
    readonly loosened: boolean
}

/** One entry an old client still sends as agreed: read and ignored. */
export type AgreedRight = RightEntry

/** Where an old grant row came from (kept for the shape of the store; nothing writes one). */
export type RightOrigin = "template" | "owner"

/** An old grant row (kept for the shape of the store; nothing writes one). */
export interface RightGrant extends RightEntry {
    /** Whether the template or the owner gave the row. */
    readonly origin: RightOrigin
}

/** Who activates a version: carried by the publish paths, decides nothing. */
export interface RightsConsent {
    /** The member who activates. */
    readonly memberId: string
    /** The role that member holds in the workspace. */
    readonly role: string
    /** The entries the client still sends as agreed: read and ignored. */
    readonly agreed: ReadonlyArray<AgreedRight>
}

/** What one activation carries to the write: the graph it is for, and NO grant row (`grants` and `pending` are always empty). */
export interface RightsSettlement {
    /** The hash of the graph the activation is for. */
    readonly graphHash: string
    /** The agent whose graph it is. */
    readonly agentId: string
    /** The workflow it is for, or null for the agent graph. */
    readonly workflowId: string | null
    /** The grant rows to write: always empty. */
    readonly grants: ReadonlyArray<RightGrant>
    /** The entries still waiting for agreement: always empty. */
    readonly pending: ReadonlyArray<AddedRight>
    /** The member who agreed, or null when nobody had to. */
    readonly agreedBy: string | null
}

/** The stricter of two modes: `ask` wins. */
export const stricterMode = (left: RightMode, right: RightMode): RightMode =>
    left === "ask" || right === "ask" ? "ask" : "auto"

/** Who activates a version, as the publish paths read the author: carried, never judged. */
export const consentOfAuthor = (
    author: { readonly memberId: string | null; readonly role?: string | undefined },
    agreed: ReadonlyArray<AgreedRight> = [],
): RightsConsent | undefined =>
    author.memberId === null ? undefined : { memberId: author.memberId, role: author.role ?? "", agreed }

/** The agreed entries an old request carries, read (they decide nothing). */
export const agreedRightsOf = (
    entries: ReadonlyArray<Omit<RightEntry, "mode"> & { readonly mode: string }> | null | undefined,
): ReadonlyArray<AgreedRight> =>
    (entries ?? []).flatMap((entry) =>
        entry.mode === "auto" || entry.mode === "ask"
            ? [{ nodeKey: entry.nodeKey, connectionId: entry.connectionId, operation: entry.operation, mode: entry.mode }]
            : [],
    )

/** The settlement of every activation: it grants and asks nothing. */
export const noRights = (graphHash: string, agentId: string, workflowId: string | null = null): RightsSettlement => ({
    graphHash,
    agentId,
    workflowId,
    grants: [],
    pending: [],
    agreedBy: null,
})

/** What was settled, or the settlement that grants nothing. */
export const settledOr = (
    settlement: RightsSettlement | undefined,
    graphHash: string,
    agentId: string,
    workflowId: string,
): RightsSettlement => settlement ?? noRights(graphHash, agentId, workflowId)

/** A node as the standing read reads it: its key, the step it runs, its mode and its providers in order. */
type StandingNode = Pick<GraphSpecNode, "key" | "step" | "mode" | "accounts">

/** The node's declared mode (its `mode`, else on a stored legacy node its accounts' `operations`), or null when it states none. */
const modeOfNode = (node: StandingNode): RightMode | null => {
    if (node.mode !== undefined) return isNodeMode(node.mode) ? node.mode : null
    const stated: ReadonlyArray<unknown> = (node.accounts ?? []).flatMap((account) => Object.values(account.operations ?? {}))
    if (stated.length === 0 || !stated.every((mode) => isNodeMode(mode))) return null
    return stated.includes("ask") ? "ask" : "auto"
}

/** The tools a node declares (its template node's `tools`); none for a node no installed template defines. */
const toolsOfNode = (node: StandingNode): ReadonlyArray<string> => {
    const template = INSTALLED.templateNodeOf(node.step)
    return template?.entry === "template-node" ? template.tools : []
}

/**
 * What every node of a running graph stands on: for each provider it lists, in its order, the agent's attached account of it
 * (`bindNodeProviders`), and on it each tool the node declares that the account serves, in the NODE'S mode, always `granted` (there is
 * nothing to agree). A node that states no mode stands on nothing (it is refused at save and at run time).
 */
export const standingRightsOf = (
    nodes: ReadonlyArray<StandingNode>,
    accounts: ReadonlyArray<ProviderAttachmentView>,
): ReadonlyArray<RightEntry & { readonly granted: boolean; readonly asked: RightMode }> =>
    nodes.flatMap((node) => {
        const mode = modeOfNode(node)
        if (mode === null) return []
        const providers = (node.accounts ?? []).flatMap((account) =>
            account.provider === null || account.provider === "nivo" ? [] : [account.provider],
        )
        const bound = bindNodeProviders(providers, accounts, () => null)
        return bound.flatMap((account) =>
            toolsOfNode(node)
                .filter((tool) => servesTool(account.provider, account.provider, tool))
                .map((operation) => ({ nodeKey: node.key, connectionId: account.connectionId, operation, mode, granted: true, asked: mode })),
        )
    })
