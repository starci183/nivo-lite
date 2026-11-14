import type { GraphNodeAccount, GraphNodeAccountMode, GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import type { FlowGraphChip } from "@starci/grammar/common"
import type { AgentRightAccountView, StepAccountView, StepAccountsView, StepEffectiveRowView } from "@/modules/types"

/*
 * What a workflow step asks to call, pure (rights.md): the node's ONE `mode` (`auto | ask`, declared by the node) and the providers it
 * acts through, `accounts` (`[{ kind, provider, connectionId }]`, in the order the ToolRunner tries them), read against the accounts the
 * agent is attached to, and the edits of the panel. The legacy per-operation `operations` of a node stored before the node's own mode is
 * read by nobody here and never written. Nothing here decides a right: the engine runs the mode the node declares.
 */

/** The kind of an account whose chip on a step card says the step messages the customer instead of a provider name. */
const MESSAGING_KIND = "messaging"

/** The words the pure builders need, resolved by the hook that owns the catalog. */
export interface StepAccountsWords {
    readonly sectionTitle: string
    readonly sectionHint: string
    readonly modeTitle: string
    readonly modeHint: string
    readonly noProvider: string
    readonly addLabel: string
    readonly addHint: (count: number) => string
    readonly removeLabel: string
    readonly modeLabel: string
    readonly modeAuto: string
    readonly modeAsk: string
    /** The line of a node that acts through providers but declares no mode. */
    readonly modeMissing: string
    /** The chip of a held account on a node that declares no mode: it claims neither `auto` nor `ask` (the engine has no default). */
    readonly modeNone: string
    readonly notAttachedLine: string
    readonly effectiveTitle: string
    readonly effectiveHint: string
    readonly notAttached: string
    readonly chipProvider: (account: string) => string
    readonly chipMessaging: (account: string) => string
}

/** The mode a node declares, or undefined for a node that declares none (a control step of the engine, or a node stored before the member). */
export const nodeModeOf = (spec: GraphSpec | null, nodeKey: string): GraphNodeAccountMode | undefined =>
    spec?.nodes.find((node) => node.key === nodeKey)?.mode

/** The accounts a node asks for in the graph; undefined when the node states none (a node from before node rights). */
export const accountsOf = (spec: GraphSpec | null, nodeKey: string): ReadonlyArray<GraphNodeAccount> | undefined =>
    spec?.nodes.find((node) => node.key === nodeKey)?.accounts

/** The graph with one node replaced by `next` of it. */
const withNode = (spec: GraphSpec, nodeKey: string, next: (node: GraphSpecNode) => GraphSpecNode): GraphSpec => ({
    ...spec,
    nodes: spec.nodes.map((node): GraphSpecNode => (node.key === nodeKey ? next(node) : node)),
})

/** The graph with one node's `accounts` replaced. */
const withAccounts = (
    spec: GraphSpec,
    nodeKey: string,
    next: (accounts: ReadonlyArray<GraphNodeAccount>) => ReadonlyArray<GraphNodeAccount>,
): GraphSpec => withNode(spec, nodeKey, (node) => ({ ...node, accounts: next(node.accounts ?? []) }))

/** The graph with the one mode of a node changed. */
export const withNodeMode = (spec: GraphSpec, nodeKey: string, mode: GraphNodeAccountMode): GraphSpec =>
    withNode(spec, nodeKey, (node) => ({ ...node, mode }))

/** The graph with an attached account joining the step, bound to its connection. */
export const withAccountAdded = (spec: GraphSpec, nodeKey: string, account: AgentRightAccountView): GraphSpec =>
    withAccounts(spec, nodeKey, (accounts) =>
        accounts.some((entry) => entry.connectionId === account.connectionId)
            ? accounts
            : [
                  ...accounts,
                  { kind: account.kind ?? account.provider, provider: account.provider, connectionId: account.connectionId },
              ],
    )

/** The graph with the entry at `index` removed from the step. */
export const withAccountRemoved = (spec: GraphSpec, nodeKey: string, index: number): GraphSpec =>
    withAccounts(spec, nodeKey, (accounts) => accounts.filter((_, position) => position !== index))

/** The attached accounts an entry speaks for: the bound one, or every attached account of the entry's kind (and provider). */
const attachedOf = (
    entry: GraphNodeAccount,
    attached: ReadonlyArray<AgentRightAccountView>,
): ReadonlyArray<AgentRightAccountView> =>
    entry.connectionId === null
        ? attached.filter(
              (account) =>
                  account.kind === entry.kind && (entry.provider === null || account.provider === entry.provider),
          )
        : attached.filter((account) => account.connectionId === entry.connectionId)

/** The attached accounts the step does not use yet (neither bound nor covered by an unbound entry): what the add-provider command offers. */
export const unusedAccountsOf = (
    entries: ReadonlyArray<GraphNodeAccount>,
    attached: ReadonlyArray<AgentRightAccountView>,
): ReadonlyArray<AgentRightAccountView> =>
    attached.filter((account) => !entries.some((entry) => attachedOf(entry, [account]).length > 0))

/** One entry of the step as a row of the panel. */
const accountViewOf = (
    entry: GraphNodeAccount,
    index: number,
    attached: ReadonlyArray<AgentRightAccountView>,
    words: StepAccountsWords,
): StepAccountView => {
    const accounts = attachedOf(entry, attached)
    return {
        index,
        name: accounts.length > 0 ? accounts.map((account) => account.name).join(", ") : (entry.provider ?? entry.kind),
        line:
            accounts.length > 0
                ? [...new Set(accounts.map((account) => account.provider))].join(", ")
                : words.notAttachedLine,
    }
}

/** The word of a held account: the node's mode, or "no mode declared" for a node that declares none (the engine has no default to claim). */
const heldWordOf = (mode: GraphNodeAccountMode | undefined, words: StepAccountsWords): string => {
    if (mode === undefined) return words.modeNone
    return mode === "auto" ? words.modeAuto : words.modeAsk
}

/**
 * What the step can really do: for each entry, the node's mode when the agent holds the account ("no mode declared" for a node that
 * declares none: the engine has no default to claim), a "not attached" line when it does not (no account, no tool: detach is the
 * kill switch).
 */
const effectiveOf = (
    entries: ReadonlyArray<GraphNodeAccount>,
    views: ReadonlyArray<StepAccountView>,
    attached: ReadonlyArray<AgentRightAccountView>,
    mode: GraphNodeAccountMode | undefined,
    words: StepAccountsWords,
): ReadonlyArray<StepEffectiveRowView> =>
    entries.map((entry, index) => {
        const isHeld = attachedOf(entry, attached).length > 0
        const held = heldWordOf(mode, words)
        return { id: `${index}`, title: views[index]?.name ?? entry.kind, chip: isHeld ? held : words.notAttached, isNone: !isHeld }
    })

/** The panel's mode and accounts sections and the effective rights beside them, for the open step. */
export const stepAccountsViewOf = (
    spec: GraphSpec | null,
    nodeKey: string,
    attached: ReadonlyArray<AgentRightAccountView>,
    words: StepAccountsWords,
    isReadOnly: boolean,
): StepAccountsView => {
    const entries = accountsOf(spec, nodeKey) ?? []
    const mode = nodeModeOf(spec, nodeKey)
    const accounts = entries.map((entry, index) => accountViewOf(entry, index, attached, words))
    return {
        sectionTitle: words.sectionTitle,
        sectionHint: words.sectionHint,
        mode:
            mode === undefined
                ? null
                : {
                      title: words.modeTitle,
                      hint: words.modeHint,
                      label: words.modeLabel,
                      value: mode,
                      options: { auto: words.modeAuto, ask: words.modeAsk },
                  },
        modeNote: mode === undefined && accounts.length > 0 ? words.modeMissing : null,
        accounts,
        noProvider: words.noProvider,
        addOptions: unusedAccountsOf(entries, attached).map((account) => ({
            id: account.connectionId,
            label: account.name,
        })),
        addLabel: words.addLabel,
        addHint: words.addHint(attached.length),
        removeLabel: words.removeLabel,
        effectiveTitle: words.effectiveTitle,
        effectiveHint: words.effectiveHint,
        effective: effectiveOf(entries, accounts, attached, mode, words),
        isReadOnly,
    }
}

/** What a step card shows of its accounts: one chip per provider the node acts through (the account's name, or the messaging chip), or the no-provider chip for an empty set. */
export const accountChipsOf = (
    spec: GraphSpec | null,
    nodeKey: string,
    attached: ReadonlyArray<AgentRightAccountView>,
    words: StepAccountsWords,
): ReadonlyArray<FlowGraphChip> => {
    const entries = accountsOf(spec, nodeKey)
    if (entries === undefined) return []
    if (entries.length === 0) return [{ label: words.noProvider, tone: "neutral" }]
    return entries.map((entry): FlowGraphChip => {
        const name = attachedOf(entry, attached)[0]?.name ?? entry.provider ?? entry.kind
        return {
            label: entry.kind === MESSAGING_KIND ? words.chipMessaging(name) : words.chipProvider(name),
            tone: "neutral",
        }
    })
}
