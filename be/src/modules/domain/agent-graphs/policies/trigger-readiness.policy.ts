import type { WorkflowTrigger } from "@nivo-lite/agent-sdk/graph"
import type { TriggerVerb } from "@nivo-lite/agent-sdk/names"
import { declarationOf, switchedOn } from "@modules/domain/provider-triggers"
import {
    providerOfSource,
    sourceStreamOf,
    switchGated,
    verbOfSource,
    type TriggerSwitchRow,
} from "@modules/domain/trigger-specs"
import type { TriggerReadiness } from "./graph-readiness.policy"
import type { AgentAttachment } from "./node-accounts.policy"

/**
 * Why a provider leaves a trigger unable to fire: the agent has no account of it (or not the one a stored trigger pins), two of its
 * accounts read ONE stream and the founder has not picked the source of that stream (`needs_pick`, owner key
 * `triggerOneSource2026_11_12`, CORRECTED 2026-11-12), or every account it has keeps the trigger off.
 */
export type TriggerBlockReason = "not_connected" | "needs_pick" | "trigger_off"

/** One provider that leaves a graph's triggers unable to fire, and why: what the agent page names. */
export interface TriggerBlock {
    /** The provider whose account or switch is missing. */
    readonly provider: string
    /** Why that provider keeps the triggers from firing. */
    readonly reason: TriggerBlockReason
    /**
     * The trigger purpose (`nivo.trigger.*`) the block is about: what a pick names (`triggerPicks` `verb`) and what the page says is off
     * or missing. Absent for a trigger the registry wraps in no verb.
     */
    readonly verb?: TriggerVerb | undefined
    /** For `needs_pick`: the stream whose source the founder must pick (`bank-account:VCB:0123`, `mailbox:ketoan@shop.vn`). */
    readonly stream?: string | undefined
    /** For `needs_pick`: the attached accounts that read that stream, one of which the founder picks. */
    readonly connectionIds?: ReadonlyArray<string> | undefined
}

/** Whether some trigger of a graph can fire, or the providers (each once, in the triggers' order) that leave none able to. */
export type TriggerFiring =
    { readonly canFire: true } | { readonly canFire: false; readonly blocked: ReadonlyArray<TriggerBlock> }

/** A graph as the trigger side of readiness reads it: its typed triggers (absent on a graph from before contracts). */
export interface TriggerReadinessGraph {
    /** The typed triggers of the graph. */
    readonly triggers?: ReadonlyArray<WorkflowTrigger> | undefined
}

/** The founder's pick of the ONE source of a stream for a graph: the verb (purpose), the stream, the account picked. */
export interface TriggerPick {
    /** The trigger purpose the pick is for. */
    readonly verb: string
    /** The stream that purpose reads. */
    readonly stream: string
    /** The account picked as the one source of that stream. */
    readonly connectionId: string
}

/** What the trigger side reads besides the graph. */
export interface TriggerReadinessFacts {
    /** The agent's attachments: the accounts it may touch, by provider. */
    readonly attachments: ReadonlyArray<AgentAttachment>
    /**
     * The trigger switches of each attached account (`provider_trigger_switches`), by connection id. Absent: the switches cannot be read
     * (no reader bound), and an attached account counts as switched on, so nothing is hidden for a switch the engine cannot see.
     */
    readonly switches?: ReadonlyMap<string, ReadonlyArray<TriggerSwitchRow>> | undefined
    /**
     * The public facts of each attached account (`connections.public_meta`), by connection id: what its stream is read from. Absent, or
     * an account missing: its stream is unknown, so it is its own and never contests another's.
     */
    readonly publicFacts?: ReadonlyMap<string, Readonly<Record<string, string>>> | undefined
    /** The founder's picks for this graph (`workflow_trigger_picks` of its workflow); absent: none. */
    readonly picks?: ReadonlyArray<TriggerPick> | undefined
}

/** One attached account bound to one purpose of a graph, and the stream it reads. */
export interface TriggerSourceBinding {
    /** The purpose the account is bound to. */
    readonly verb: TriggerVerb
    /** The provider of the account. */
    readonly provider: string
    /** The attached account. */
    readonly connectionId: string
    /** The stream the account reads for that purpose. */
    readonly stream: string
}

/** A stream two or more attached accounts read for one purpose, with no pick yet: the engine never picks. */
export interface ContestedStream {
    /** The purpose the stream serves. */
    readonly verb: TriggerVerb
    /** The stream several accounts read. */
    readonly stream: string
    /** The accounts that read it. */
    readonly accounts: ReadonlyArray<{ readonly provider: string; readonly connectionId: string }>
}

/**
 * How a graph's triggers bind to the workspace's accounts (owner key `triggerOneSource2026_11_12`, CORRECTED 2026-11-12: ONE SOURCE PER
 * STREAM): the accounts that are sources (every account whose stream no other account reads, and the picked one of a stream several
 * read), the accounts that wake nothing (the others of a picked stream: they keep writing raw rows), and the streams still contested.
 */
export interface TriggerBinding {
    /** The accounts that wake the graph. */
    readonly sources: ReadonlyArray<TriggerSourceBinding>
    /** The accounts that wake nothing because another account of their stream is picked. */
    readonly muted: ReadonlyArray<TriggerSourceBinding>
    /** The streams still waiting for a pick. */
    readonly contested: ReadonlyArray<ContestedStream>
}

/** Whether a graph listens through an account trigger switch at all: only such a graph is ever hidden by the trigger side. */
export const listensThroughSwitch = (graph: TriggerReadinessGraph): boolean =>
    (graph.triggers ?? []).some((trigger) => switchGated(trigger.source))

/** The attached accounts one trigger may be bound to: the one a stored trigger pins, else every account of its provider. */
const candidatesOf = (
    trigger: WorkflowTrigger,
    provider: string,
    attachments: ReadonlyArray<AgentAttachment>,
): ReadonlyArray<AgentAttachment> => {
    const pinned = trigger.source.connectionId
    return attachments.filter(
        (attachment) => attachment.provider === provider && (pinned === null || attachment.connectionId === pinned),
    )
}

/**
 * Whether an account can wake one trigger: a source no switch gates (a channel) always can; a provider trigger can
 * when the account's switch for it is on (the row a person set, else the declaration's default: concept triggers rule 6a), or the
 * switches cannot be read.
 */
const wakes = (trigger: WorkflowTrigger, connectionId: string, facts: TriggerReadinessFacts): boolean => {
    if (!switchGated(trigger.source)) return true
    const { switches } = facts
    if (switches === undefined) return true
    const name = trigger.source.trigger ?? ""
    const row = (switches.get(connectionId) ?? []).find((one) => one.triggerName === name)
    return switchedOn(row, declarationOf(trigger.source.provider ?? "", name))
}

/** One account that can wake a purpose of the graph, with the stream it reads. */
interface LiveAccount {
    readonly verb: TriggerVerb
    readonly provider: string
    readonly connectionId: string
    readonly stream: string
}

/** The accounts that can wake each purpose of the graph, each once, in the triggers' order then the attachments'. */
const liveAccountsOf = (graph: TriggerReadinessGraph, facts: TriggerReadinessFacts): ReadonlyArray<LiveAccount> => {
    const seen = new Set<string>()
    const live: Array<LiveAccount> = []
    for (const trigger of graph.triggers ?? []) {
        const provider = providerOfSource(trigger.source)
        const verb = verbOfSource(trigger.source)
        if (provider === null || verb === null) continue
        for (const account of candidatesOf(trigger, provider, facts.attachments)) {
            const key = `${verb}\u0000${account.connectionId}`
            if (seen.has(key) || !wakes(trigger, account.connectionId, facts)) continue
            seen.add(key)
            const stream = sourceStreamOf(verb, provider, account.connectionId, facts.publicFacts?.get(account.connectionId) ?? {})
            live.push({ verb, provider, connectionId: account.connectionId, stream })
        }
    }
    return live
}

/**
 * THE BINDING of a graph's triggers to the workspace's accounts: per purpose (verb), the accounts that can wake it grouped by the stream
 * each reads (`sourceStreamOf`: exact equality of the declared identity, an unknown stream its own). A stream ONE account reads: that
 * account is a source. A stream several read: the founder's pick for the purpose and stream, when it names one of them, is the source and
 * the others are muted; with no such pick the stream is contested (the engine never picks).
 */
export const triggerBindingOf = (graph: TriggerReadinessGraph, facts: TriggerReadinessFacts): TriggerBinding => {
    const groups = new Map<string, Array<LiveAccount>>()
    for (const account of liveAccountsOf(graph, facts)) {
        const key = `${account.verb}\u0000${account.stream}`
        groups.set(key, [...(groups.get(key) ?? []), account])
    }
    const sources: Array<TriggerSourceBinding> = []
    const muted: Array<TriggerSourceBinding> = []
    const contested: Array<ContestedStream> = []
    for (const group of groups.values()) {
        const [first, second] = group
        if (first === undefined) continue
        if (second === undefined) {
            sources.push(first)
            continue
        }
        const pick = (facts.picks ?? []).find(
            (one) =>
                one.verb === first.verb &&
                one.stream === first.stream &&
                group.some((account) => account.connectionId === one.connectionId),
        )
        if (pick === undefined) {
            const accounts = group.map(({ provider, connectionId }) => ({ provider, connectionId }))
            contested.push({ verb: first.verb, stream: first.stream, accounts })
            continue
        }
        for (const account of group) (account.connectionId === pick.connectionId ? sources : muted).push(account)
    }
    return { sources, muted, contested }
}

/** The blocks of the contested streams: each stream once per provider among its accounts, naming the stream and its accounts. */
const pickBlocksOf = (contested: ReadonlyArray<ContestedStream>): ReadonlyArray<TriggerBlock> =>
    contested.flatMap((entry) => {
        const connectionIds = entry.accounts.map((account) => account.connectionId)
        return [...new Set(entry.accounts.map((account) => account.provider))].map(
            (provider): TriggerBlock => ({ provider, reason: "needs_pick", verb: entry.verb, stream: entry.stream, connectionIds }),
        )
    })

/** Whether one trigger can fire through the bound sources, or the provider that keeps it from firing and why. */
const blockOf = (trigger: WorkflowTrigger, facts: TriggerReadinessFacts, binding: TriggerBinding): TriggerBlock | null => {
    const { source } = trigger
    // The engine's own roads and the customer channels (the connection's owner agent) need no switch: they fire.
    if (!switchGated(source) || source.provider === undefined || source.trigger === undefined) return null
    const provider = source.provider
    const quiet = new Set(binding.muted.map((entry) => entry.connectionId))
    const own = candidatesOf(trigger, provider, facts.attachments).filter((account) => !quiet.has(account.connectionId))
    const verb = verbOfSource(source) ?? undefined
    if (own.length === 0) return { provider, reason: "not_connected", verb }
    return own.some((account) => wakes(trigger, account.connectionId, facts)) ? null : { provider, reason: "trigger_off", verb }
}

/** How far a provider got towards firing: a later reason names more of what the founder must still do. */
const REASON_RANK: Readonly<Record<TriggerBlockReason, number>> = { not_connected: 0, needs_pick: 1, trigger_off: 2 }

/**
 * THE TRIGGER SIDE OF READINESS (contract C3/C5; owner key `triggerOneSource2026_11_12`, CORRECTED 2026-11-12): a stream two attached
 * accounts read for one purpose with no pick HIDES the graph (`needs_pick`, naming the stream and its accounts: the engine never picks,
 * whatever else could fire). Otherwise a graph can fire when ONE of its triggers can: a trigger of the engine's own road or of a
 * customer channel always can; a provider trigger can when one of its bound accounts (every attached account of the
 * provider, the muted ones of a picked stream aside; the pinned one of a stored trigger) has its switch for that trigger ON. A graph from
 * before contracts (no typed triggers) takes no provider trigger and can fire. When none can, the providers that keep them are named,
 * each once, by the furthest reason: `trigger_off`, then `not_connected`.
 */
export const triggerFiringOf = (graph: TriggerReadinessGraph, facts: TriggerReadinessFacts): TriggerFiring => {
    const triggers = graph.triggers ?? []
    if (triggers.length === 0) return { canFire: true }
    const binding = triggerBindingOf(graph, facts)
    if (binding.contested.length > 0) return { canFire: false, blocked: pickBlocksOf(binding.contested) }
    const blocks: Array<TriggerBlock> = []
    for (const trigger of triggers) {
        const block = blockOf(trigger, facts, binding)
        if (block === null) return { canFire: true }
        blocks.push(block)
    }
    const named = new Map<string, TriggerBlock>()
    for (const block of blocks) {
        const held = named.get(block.provider)
        if (held === undefined || REASON_RANK[block.reason] > REASON_RANK[held.reason]) named.set(block.provider, block)
    }
    return { canFire: false, blocked: [...named.values()] }
}

/** The trigger side as `graphReadinessOf` takes it (E4's hook): the providers it waits for and why, none when some trigger can fire. */
export const triggerReadinessOf = (firing: TriggerFiring): TriggerReadiness =>
    firing.canFire
        ? { waitingFor: [], blocked: [] }
        : { waitingFor: [...new Set(firing.blocked.map((block) => block.provider))], blocked: firing.blocked }
