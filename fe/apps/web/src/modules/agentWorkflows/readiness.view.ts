import type { ReadinessNextView, ReadinessPickView, ReadinessReason, ReadinessRowView } from "@/modules/types"

/*
 * Why a workflow cannot run, as rows (templates.md rule 8, triggers.md rules 2 and 6): a graph none of whose triggers can fire, or whose
 * blocking node has no provider that serves it, is HIDDEN, and the agent page says why, one row per reason, each with its ONE next step.
 * The back end sends `readiness.blocked[]` (`provider`, `reason`, and for `needs_pick` the `stream` and the `connectionIds` that read
 * it). The reasons it can give are named here once; a reason this view does not know is still a row (the provider and a link to
 * the connections), never a hole. Pure: the words and the addresses are handed in.
 */

/** Every reason a block can give (`ReadinessBlockReason` of the back end's graph readiness); the type is `ReadinessReason`. */
export const READINESS_REASONS: ReadonlyArray<ReadinessReason> = ["not_connected", "trigger_off", "needs_pick", "tool_unavailable", "needs_reconnect"]

/** One provider that keeps a workflow hidden, as the list answers it. `verb` and `tool` are read when the answer carries them. */
export interface ReadinessBlockInput {
    readonly provider: string
    readonly reason: string
    readonly stream: string | null
    readonly connectionIds: ReadonlyArray<string>
    /** For `needs_pick`: the trigger verb the pick names (`agreeAgentNodeRights` `triggerPicks[].verb`); absent where the answer does not carry it. */
    readonly verb?: string | null | undefined
    /** For `tool_unavailable`: the tool no bound account of the provider serves; absent where the answer does not carry it. */
    readonly tool?: string | null | undefined
}

/** One workflow of the list with its readiness (null where it could not be read). */
export interface ReadinessWorkflowInput {
    readonly id: string
    readonly key: string
    readonly name: string
    readonly readiness: {
        readonly hidden: boolean
        readonly waitingFor: ReadonlyArray<string>
        readonly blocked: ReadonlyArray<ReadinessBlockInput>
        /** The agent's attached accounts whose provider refused the credential; absent where the answer does not carry it. */
        readonly reconnect?: ReadonlyArray<{ readonly provider: string; readonly connectionId: string }> | undefined
    } | null
}

/** The words of the rows, resolved by the hook that owns the catalog. */
export interface ReadinessWords {
    /** The provider in words ("SePay", "Zalo OA"). */
    readonly providerName: (provider: string) => string
    /** The tool by its label; the general phrase when no label names it or the answer names none. */
    readonly toolName: (tool: string | null) => string
    /** The name of one attached account, by its connection id; the id itself when it is not among the agent's accounts. */
    readonly accountName: (connectionId: string) => string
    readonly notConnected: (provider: string) => string
    readonly triggerOff: (provider: string) => string
    readonly needsPickStream: (values: { readonly provider: string; readonly stream: string }) => string
    readonly needsPickStep: (provider: string) => string
    /** An attached account whose provider refused the credential: the owner connects it again. */
    readonly needsReconnect: (values: { readonly provider: string; readonly account: string }) => string
    readonly reconnect: string
    readonly toolUnavailable: (values: { readonly tool: string; readonly provider: string }) => string
    readonly waiting: (provider: string) => string
    readonly connect: (provider: string) => string
    readonly enableTrigger: string
    readonly pick: string
    readonly openMap: string
    readonly seeConnections: string
}

/** Where the next steps lead. */
export interface ReadinessLinks {
    /** The connections page: connect a provider, switch a trigger on, see what serves a tool. */
    readonly connectionsHref: string
    /** The map of one workflow (its steps and the accounts each acts through). */
    readonly mapHrefOf: (workflowKey: string) => string
}

const KNOWN_REASONS: ReadonlySet<string> = new Set(READINESS_REASONS)

const isReason = (reason: string): reason is ReadinessReason => KNOWN_REASONS.has(reason)

/** The row of a contested source: the choice in place when the answer names the stream and the verb, else where the pick is made. */
const needsPickRowOf = (
    workflow: ReadinessWorkflowInput,
    block: ReadinessBlockInput,
    base: Pick<ReadinessRowView, "id" | "workflowId" | "workflowName">,
    words: ReadinessWords,
    links: ReadinessLinks,
): ReadinessRowView => {
    const provider = words.providerName(block.provider)
    if (block.stream === null)
        return {
            ...base,
            reason: "needs_pick",
            text: words.needsPickStep(provider),
            next: { kind: "link", label: words.openMap, href: links.mapHrefOf(workflow.key) },
        }
    const verb = block.verb ?? ""
    const next: ReadinessNextView | null =
        verb === "" || block.connectionIds.length < 2
            ? null
            : {
                  kind: "pick",
                  label: words.pick,
                  pick: pickOf(workflow.id, verb, block.stream, block.connectionIds, words),
              }
    return { ...base, reason: "needs_pick", text: words.needsPickStream({ provider, stream: block.stream }), next }
}

/** The choice of a contested stream: its accounts, named by their own names. */
const pickOf = (
    workflowId: string,
    verb: string,
    stream: string,
    connectionIds: ReadonlyArray<string>,
    words: ReadinessWords,
): ReadinessPickView => ({
    workflowId,
    verb,
    stream,
    options: connectionIds.map((connectionId) => ({ connectionId, label: words.accountName(connectionId) })),
})

/** One block of one workflow as a row. */
const rowOf = (
    workflow: ReadinessWorkflowInput,
    block: ReadinessBlockInput,
    at: number,
    words: ReadinessWords,
    links: ReadinessLinks,
): ReadinessRowView => {
    const provider = words.providerName(block.provider)
    const base = {
        id: `${workflow.id}:${block.reason}:${block.provider}:${block.stream ?? ""}:${at}`,
        workflowId: workflow.id,
        workflowName: workflow.name,
    }
    const connections = (label: string): ReadinessNextView => ({ kind: "link", label, href: links.connectionsHref })
    if (!isReason(block.reason))
        return { ...base, reason: "other", text: words.waiting(provider), next: connections(words.seeConnections) }
    switch (block.reason) {
        case "not_connected":
            return { ...base, reason: block.reason, text: words.notConnected(provider), next: connections(words.connect(provider)) }
        case "trigger_off":
            return { ...base, reason: block.reason, text: words.triggerOff(provider), next: connections(words.enableTrigger) }
        case "tool_unavailable":
            return {
                ...base,
                reason: block.reason,
                text: words.toolUnavailable({ tool: words.toolName(block.tool ?? null), provider }),
                next: connections(words.seeConnections),
            }
        case "needs_pick":
            return needsPickRowOf(workflow, block, base, words, links)
        case "needs_reconnect":
            return { ...base, reason: block.reason, text: words.waiting(provider), next: connections(words.seeConnections) }
    }
}

/**
 * The rows of every workflow that is hidden, in the workflows' order and each workflow's blocks' order. A hidden workflow whose blocks
 * are empty still says what it waits for (`waitingFor`, each provider once, as not connected); a shown workflow has no row.
 */
export const readinessRowsOf = (
    workflows: ReadonlyArray<ReadinessWorkflowInput>,
    words: ReadinessWords,
    links: ReadinessLinks,
): ReadonlyArray<ReadinessRowView> => {
    const hidden = workflows.flatMap((workflow) => {
        const readiness = workflow.readiness
        if (readiness?.hidden !== true) return []
        const blocks: ReadonlyArray<ReadinessBlockInput> =
            readiness.blocked.length > 0
                ? readiness.blocked
                : readiness.waitingFor.map((provider) => ({
                      provider,
                      reason: "not_connected",
                      stream: null,
                      connectionIds: [],
                  }))
        return blocks.map((block, at) => rowOf(workflow, block, at, words, links))
    })
    return [...hidden, ...reconnectRowsOf(workflows, words, links)]
}

/**
 * The rows of the attached accounts whose provider refused the credential (`needs_reconnect`), once each (the account is the agent's, every
 * workflow of the agent names it): shown whether the workflows are hidden or not, because sends still try and the engine reports a failure
 * as usual. The next step is the connections page, where the provider's own reconnect action is.
 */
const reconnectRowsOf = (
    workflows: ReadonlyArray<ReadinessWorkflowInput>,
    words: ReadinessWords,
    links: ReadinessLinks,
): ReadonlyArray<ReadinessRowView> => {
    const seen = new Set<string>()
    return workflows.flatMap((workflow) =>
        (workflow.readiness?.reconnect ?? []).flatMap((need): ReadonlyArray<ReadinessRowView> => {
            if (seen.has(need.connectionId)) return []
            seen.add(need.connectionId)
            return [
                {
                    id: `${workflow.id}:needs_reconnect:${need.connectionId}`,
                    workflowId: workflow.id,
                    workflowName: workflow.name,
                    reason: "needs_reconnect",
                    text: words.needsReconnect({ provider: words.providerName(need.provider), account: words.accountName(need.connectionId) }),
                    next: { kind: "link", label: words.reconnect, href: links.connectionsHref },
                },
            ]
        }),
    )
}
