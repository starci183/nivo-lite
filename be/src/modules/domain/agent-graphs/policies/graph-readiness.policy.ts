import {
    NIVO_PROVIDER,
    nodeProvidersOf,
    type AgentAttachment,
    type BindOptions,
    type NodeAccountEntry,
    type NodeProvider,
} from "./node-accounts.policy"

/**
 * Why a provider keeps a graph hidden: the agent has no account of it (`not_connected`), every account it has keeps the graph's trigger
 * off (`trigger_off`), it has several accounts of it and none is picked (`needs_pick`), or its account
 * is bound but serves no operation of one tool the node needs (`tool_unavailable`: a platform purpose an OpenAPI source serves only
 * where its PINNED document marks it, and the bound account's document marks none; the block names the tool).
 */
export type ReadinessBlockReason = "not_connected" | "trigger_off" | "needs_pick" | "tool_unavailable"

/** One provider that keeps a graph hidden, and why: what the agent page says next to it. */
export interface ReadinessBlock {
    /** The provider whose account or switch is missing. */
    readonly provider: string
    /** Why that provider keeps the graph hidden. */
    readonly reason: ReadinessBlockReason
    /** For a block a trigger causes (`not_connected`, `trigger_off`, `needs_pick`): the trigger purpose (`nivo.trigger.*`) it is about. */
    readonly verb?: string | undefined
    /** For a trigger's `needs_pick`: the stream two attached accounts read, whose one source the founder picks. */
    readonly stream?: string | undefined
    /** For a trigger's `needs_pick`: the accounts that read that stream. */
    readonly connectionIds?: ReadonlyArray<string> | undefined
    /** For `tool_unavailable`: the tool (`nivo.tool.*`) no bound account of the provider serves. */
    readonly tool?: string | undefined
}

/**
 * Whether a graph shows: hidden (no trigger registered, no call routed, the agent page names the providers it waits for and why, one
 * entry per provider and reason), or shown with the side nodes that are skipped (none of their providers bound; named on the agent page).
 */
export type GraphReadiness =
    | { readonly hidden: false; readonly skipped: ReadonlyArray<string>; readonly reconnect?: ReadonlyArray<ReconnectNeed> | undefined }
    | {
          readonly hidden: true
          readonly waitingFor: ReadonlyArray<string>
          readonly blocked: ReadonlyArray<ReadinessBlock>
          readonly reconnect?: ReadonlyArray<ReconnectNeed> | undefined
      }

/**
 * An attached account whose provider refused the credential (`needs_reauth`): the agent's sends through it fail until the owner connects it
 * again. It hides nothing (sends still try and the engine reports a failure to /chat as usual); the agent page says it.
 */
export interface ReconnectNeed {
    readonly provider: string
    readonly connectionId: string
}

/** A step of a graph as readiness reads it, in either form: `@1` (`blocking?: boolean`, `step`) or `@2` (`blocking?: false`). */
export interface ReadinessNode {
    /** The key of the step. */
    readonly key: string
    /** The node it runs (`@1`: the SDK step id; `@2`: the template node id or a `core.*` control step); absent for none. */
    readonly step?: string | undefined
    /** Its account entries, in priority order; absent on a `@1` node from before node rights and on a control step. */
    readonly accounts?: ReadonlyArray<NodeAccountEntry> | undefined
    /** False for a side node; absent takes the node definition's own (`@1`), else it blocks. */
    readonly blocking?: boolean | undefined
}

/**
 * The trigger side of readiness (a graph none of whose triggers can fire is hidden the same way): a LATER slice (C5, the trigger
 * registry) gives it. Absent: not judged here. `waitingFor` = the providers whose absence leaves no trigger of the graph able to fire;
 * empty: some trigger can fire.
 */
export interface TriggerReadiness {
    /** The providers whose absence leaves no trigger of the graph able to fire. */
    readonly waitingFor: ReadonlyArray<string>
    /** Why each of `waitingFor` keeps the triggers from firing; absent: `not_connected` for each. */
    readonly blocked?: ReadonlyArray<ReadinessBlock> | undefined
}

/** What readiness reads besides the graph. */
export interface ReadinessInput extends BindOptions {
    /** The agent's attachments (tier 1): the connected accounts it may touch, by provider. */
    readonly attachments: ReadonlyArray<AgentAttachment>
    /**
     * The account the owner picked for a provider the agent has several accounts of (the workspace's default account of the provider's
     * kind), or null: of several accounts, only the picked one binds the provider (never a guess). Absent: none is picked.
     */
    readonly picked?: ((provider: string) => string | null) | undefined
    /** The node definition's own `blocking` for a `@1` step that states none; absent: it blocks. */
    readonly definedBlocking?: ((step: string) => boolean | undefined) | undefined
    /** The trigger side, from the later slice; absent: not judged. */
    readonly triggers?: TriggerReadiness | undefined
    /**
     * The tools served only by some accounts (`ToolSpec.availability` `pinned-mark`: an OpenAPI source's purpose, served where the
     * account's PINNED document marks it), each with the agent's accounts that serve it; a provider is bound FOR such a tool only through
     * one of them. A tool absent from the map is judged as before; the map absent: no tool is judged so.
     */
    readonly served?: ReadonlyMap<string, ReadonlySet<string>> | undefined
}

/** Whether a step blocks its run: its own `blocking` when it says one, else its definition's, else it blocks (as `nodeBlocks`). */
const blocks = (node: ReadinessNode, input: ReadinessInput): boolean =>
    (node.blocking ?? (node.step === undefined ? undefined : input.definedBlocking?.(node.step))) !== false

/**
 * The accounts that bind one provider of a node (`nivo` needs none): the account a `@1` entry pins, when the agent is attached to it;
 * else the agent's one account of the provider; of several, the one the owner picked (`picked`), else none.
 */
const boundAccountsOf = (_nodeKey: string, wanted: NodeProvider, input: ReadinessInput): ReadonlyArray<string> => {
    const own = input.attachments.filter((attachment) => attachment.provider === wanted.provider).map((one) => one.connectionId)
    const { pinned } = wanted
    if (pinned !== null) return own.filter((connectionId) => connectionId === pinned)
    if (own.length <= 1) return own
    const picked = input.picked?.(wanted.provider) ?? null
    return own.filter((connectionId) => connectionId === picked)
}

/** Whether one provider of a node is bound: `nivo` always; else some account binds it (`boundAccountsOf`). */
const boundProvider = (nodeKey: string, wanted: NodeProvider, input: ReadinessInput): boolean =>
    wanted.provider === NIVO_PROVIDER || boundAccountsOf(nodeKey, wanted, input).length > 0

/**
 * Whether a bound provider serves one tool for the node: always, unless the tool is served only by some accounts (`served`); then one
 * of the accounts that bind the provider must be among them (`nivo` holds no account, so it serves none of those).
 */
const servesTool = (nodeKey: string, wanted: NodeProvider, tool: string, input: ReadinessInput): boolean => {
    const serving = input.served?.get(tool)
    if (serving === undefined) return true
    return boundAccountsOf(nodeKey, wanted, input).some((connectionId) => serving.has(connectionId))
}

/**
 * Why one provider of a node is not bound (it is not, `boundProvider`): the agent has accounts of it (the pinned one among them, for a
 * pinned entry), so the owner must pick one (`needs_pick`); or it has none (`not_connected`).
 */
const unboundReasonOf = (wanted: NodeProvider, input: ReadinessInput): ReadinessBlockReason => {
    const own = input.attachments.filter((attachment) => attachment.provider === wanted.provider)
    const { pinned } = wanted
    if (pinned !== null) return "not_connected"
    return own.length > 1 ? "needs_pick" : "not_connected"
}

/**
 * What one node waits for, PER TOOL (contract ADDENDUM 2 point 4): a provider is an alternative only for the tools it serves,
 * so the node is ready when every tool listed under some provider has at least one of those providers bound (`nivo` always is). The
 * answer is the providers of the tools that have none bound, in the node's order of providers, each once; empty: the node is ready (a
 * node that lists no account included).
 */
const waitingOfNode = (node: ReadinessNode, input: ReadinessInput): ReadonlyArray<string> =>
    blocksOfNode(node, input).map((block) => block.provider)

/**
 * What one node waits for (as `waitingOfNode`), each provider with why: not bound (`unboundReasonOf`), or bound but serving a tool it
 * lists that no provider of the node serves (`tool_unavailable`, one block per such tool, naming it).
 */
const blocksOfNode = (node: ReadinessNode, input: ReadinessInput): ReadonlyArray<ReadinessBlock> => {
    const providers = nodeProvidersOf(node, input)
    const bound = new Set(
        providers.filter((wanted) => boundProvider(node.key, wanted, input)).map((wanted) => wanted.provider),
    )
    const unmet = new Set<string>()
    for (const wanted of providers)
        for (const tool of wanted.operations)
            if (
                !providers.some(
                    (other) =>
                        bound.has(other.provider) &&
                        other.operations.includes(tool) &&
                        servesTool(node.key, other, tool, input),
                )
            )
                unmet.add(tool)
    return providers
        .filter((wanted) => wanted.operations.some((tool) => unmet.has(tool)))
        .flatMap((wanted): ReadonlyArray<ReadinessBlock> => {
            if (!bound.has(wanted.provider)) return [{ provider: wanted.provider, reason: unboundReasonOf(wanted, input) }]
            return wanted.operations
                .filter((tool) => unmet.has(tool))
                .map((tool): ReadinessBlock => ({ provider: wanted.provider, reason: "tool_unavailable", tool }))
        })
}

/**
 * Blocks once each by provider, reason, (a trigger's pick) stream and (an unavailable tool) tool, in order. A pick is per trigger purpose, so
 * a `needs_pick` block is also told apart by its verb; any other block that a node and a trigger both raise stays one, and keeps the verb
 * the trigger gave it.
 */
const distinctBlocks = (blocks: ReadonlyArray<ReadinessBlock>): ReadonlyArray<ReadinessBlock> => {
    const kept = new Map<string, ReadinessBlock>()
    for (const block of blocks) {
        const verbPart = block.reason === "needs_pick" && block.stream !== undefined ? (block.verb ?? "") : ""
        const key = `${block.provider}\u0000${block.reason}\u0000${verbPart}\u0000${block.stream ?? ""}\u0000${block.tool ?? ""}`
        const held = kept.get(key)
        if (held === undefined) kept.set(key, block)
        else if (held.verb === undefined && block.verb !== undefined) kept.set(key, { ...held, verb: block.verb })
    }
    return [...kept.values()]
}

/**
 * THE READINESS of a graph for one agent (one pure engine function, read by the router, the trigger takers and the agent page): a
 * BLOCKING node with a tool none of whose providers is bound HIDES the graph, `waitingFor` naming the providers of those tools (in the
 * nodes' order, each once); a NON-blocking one is skipped and named. Readiness is per TOOL: a CRM read and an SMTP send need the CRM AND
 * SMTP, a send listed under three messaging providers needs one of them. A node that lists no accounts (`@1`: no `accounts` member, as
 * every graph from before node rights; `[]`: NIVO's own tools only) is ready exactly as today; a tool `nivo` lists is always met. The
 * trigger side, once given, hides the same way.
 */
export const graphReadinessOf = (
    spec: { readonly nodes: ReadonlyArray<ReadinessNode> },
    input: ReadinessInput,
): GraphReadiness => {
    const waiting: Array<ReadinessBlock> = []
    const skipped: Array<string> = []
    for (const node of spec.nodes) {
        const missing = blocksOfNode(node, input)
        if (missing.length === 0) continue
        if (blocks(node, input)) waiting.push(...missing)
        else skipped.push(node.key)
    }
    const triggers = input.triggers
    if (triggers !== undefined)
        waiting.push(
            ...(triggers.blocked ??
                triggers.waitingFor.map((provider): ReadinessBlock => ({ provider, reason: "not_connected" }))),
        )
    return waiting.length > 0
        ? {
              hidden: true,
              waitingFor: [...new Set(waiting.map((block) => block.provider))],
              blocked: distinctBlocks(waiting),
          }
        : { hidden: false, skipped }
}

/** The providers one side node waits for (per tool, as `graphReadinessOf`), or null when it runs: what the run's passed-over path names when it skips it. */
export const sideNodeWaitingOf = (node: ReadinessNode, input: ReadinessInput): ReadonlyArray<string> | null => {
    if (blocks(node, input)) return null
    const missing = waitingOfNode(node, input)
    return missing.length === 0 ? null : missing
}
