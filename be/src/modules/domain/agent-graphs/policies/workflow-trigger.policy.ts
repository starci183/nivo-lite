import {
    LATEST_VERSION,
    PROVIDER_TRIGGER_MEMBER,
    WORKFLOW_CALL_MEMBER,
    conditionsHold,
    providerTriggerOf,
    type GraphSpec,
    type GraphTagSource,
    type WorkflowCallPin,
    type WorkflowTrigger,
} from "@nivo-lite/agent-sdk/graph"
import { TRIGGER, type TriggerVerb } from "@nivo-lite/agent-sdk/names"
import { TEMPLATE_WAIT_STEP } from "@modules/domain/installed-plugins"
import { providerOfSource, roadOfSource, verbOfSource, verbOfWake } from "@modules/domain/trigger-specs"
import type { TriggerBinding } from "./trigger-readiness.policy"

/** What `triggerTakes` reads of a graph's binding to the workspace's accounts (`triggerBindingOf`): its sources and its muted accounts. */
export type TriggerTakesBinding = Pick<TriggerBinding, "sources" | "muted">

/** The member of a call's scope (and of its wake's tag context) that names the calling run. */
export const CALLER_MEMBER = "caller"

/**
 * The member of a trigger scope that lists what of the run's customer waits for the founder (a frozen workflow: the step it stopped
 * on, since when). The engine fills it when a run starts; the turn carries it to every agent of the run.
 */
export const WAITING_MEMBER = "waitingOnFounder"

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The pin of an end hand-off a tag carries (the workflow and version it calls), or null for any other tag. */
export const workflowCallOf = (payload: Readonly<Record<string, unknown>>): WorkflowCallPin | null => {
    const call = payload[WORKFLOW_CALL_MEMBER]
    if (!isRecord(call) || typeof call.workflow !== "string" || call.workflow === "") return null
    const version = call.version
    if (version === LATEST_VERSION) return { workflow: call.workflow, version }
    return typeof version === "number" && Number.isSafeInteger(version) && version > 0
        ? { workflow: call.workflow, version }
        : null
}

/** What a wake brings that the contract-form trigger scope reads. */
export interface ContractWake {
    /** The members the door wrote, flat. */
    readonly members: Readonly<Record<string, unknown>>
    /** The plain data of the tag. */
    readonly payload: Readonly<Record<string, unknown>>
}

/**
 * The params a tag wake supplies at the top of the trigger scope (`trigger.<name>`), beyond the members its door wrote: the tag's plain
 * data, member by member, where the door wrote no member of that name. A workflow call is no tag: it comes through the one event pipeline,
 * whose scope is rebuilt from the event (`trigger.data`, `trigger.caller`).
 */
export const suppliedScopeOf = (wake: ContractWake): Readonly<Record<string, unknown>> => {
    const { members, payload } = wake
    return Object.fromEntries(Object.entries(payload).filter(([name]) => !(name in members)))
}

/**
 * THE VERB OF A WAKE as the routing reads it (every wake carries one): a wake of the one event pipeline names it (a workflow call
 * included: `workflow.called`, pinned on the wake); a wake on the `agent` road is
 * `workflow.called` only when an agent wrote it (`authorAgentId`, the tag door's member): the road is also where a wake of an unknown
 * source falls (a generic webhook's event), which no agent called; any other wake's verb is the one its producer's typed members name
 * (`verbOfWake`: the channel, the provider trigger, the system tag source, the road). Null for a wake that names none: it is unroutable,
 * starts nothing, and the engine reports it.
 */
export const wakeVerbOf = (road: GraphTagSource, scope: Readonly<Record<string, unknown>>): TriggerVerb | null => {
    // A wake of the one event pipeline names its verb itself (lane concept triggers rule 13): no road decides it.
    const named = pipelineVerbOf(scope)
    if (named !== null) return named
    if (road === "agent" && (typeof scope.authorAgentId !== "string" || scope.authorAgentId === "")) return null
    return verbOfWake({ road, scope })
}

/** Every verb of `TRIGGER`, to tell a verb a wake names from any other text. */
const VERBS: ReadonlySet<string> = new Set<string>(Object.values(TRIGGER))

/** True for a text that is a verb of `TRIGGER`. */
const isVerb = (value: unknown): value is TriggerVerb => typeof value === "string" && VERBS.has(value)

/** The member of a pipeline wake's scope that names its verb (the producer's own: `deliver` writes it). */
export const VERB_MEMBER = "verb"

/** The verb a wake of the one event pipeline names (its `verb` member), or null for any other wake. */
export const pipelineVerbOf = (scope: object): TriggerVerb | null => {
    const named: unknown = Reflect.get(scope, VERB_MEMBER)
    return isVerb(named) ? named : null
}

/**
 * True for a pipeline event ABOUT A PERSON on an account (a customer line, the hand-back of a held conversation): the producer named its
 * verb, the engine met the person's route and the event came through an account. What the gates that serve people (working hours, the
 * keeper of a conversation, a line never dropped untold) take, in place of the old `customer` wake source.
 */
export const personEventOf = (context: object): boolean =>
    pipelineVerbOf(context) !== null &&
    typeof Reflect.get(context, "conversationId") === "string" &&
    typeof Reflect.get(context, "connectionId") === "string"

/**
 * Whether one trigger takes an event of the one event pipeline: the trigger registers on the event's VERB, a trigger a stored graph pins
 * to one account takes only an event of that account, the graph's binding does not mute the event's account (one source per stream), and
 * the trigger's conditions hold over the event's generic scope (`eventId`, `accountId`, `contactId`, `routeId`, `data.*`). No road, no tag
 * source and no provider trigger name is compared: the verb is the event's own.
 */
const pipelineTriggerTakes = (
    trigger: WorkflowTrigger,
    verb: TriggerVerb,
    scope: Readonly<Record<string, unknown>>,
    binding?: TriggerTakesBinding,
): boolean => {
    if (verbOfSource(trigger.source) !== verb) return false
    const account = typeof scope.accountId === "string" && scope.accountId !== "" ? scope.accountId : null
    const pinned = trigger.source.connectionId
    if (pinned !== null && account !== pinned) return false
    if (binding !== undefined && account !== null) {
        const muted = binding.muted.some((entry) => entry.verb === verb && entry.connectionId === account)
        if (muted) return false
    }
    return conditionsHold(trigger.conditions, scope)
}

/** The provider trigger a wake comes from (`<provider>:<trigger>`, as the emit point wrote it), or null for any other wake. */
export const providerTriggerOfWake = (scope: Readonly<Record<string, unknown>>): string | null => {
    const fired = scope[PROVIDER_TRIGGER_MEMBER]
    return typeof fired === "string" && fired !== "" ? fired : null
}

/**
 * Whether the binding mutes a wake of one trigger (owner key `triggerOneSource2026_11_12`, CORRECTED 2026-11-12: one source per stream): a
 * wake naming an account the founder did not pick for its stream takes nothing; a wake naming NO account (a channel line names its
 * conversation, not its account) takes nothing only when every bound account of the trigger's provider for the verb is muted (the founder
 * picked another provider's account for that stream), and takes while one of them is a source, or with no binding.
 */
const mutedBy = (trigger: WorkflowTrigger, scope: Readonly<Record<string, unknown>>, binding: TriggerTakesBinding): boolean => {
    const verb = verbOfSource(trigger.source)
    const provider = providerOfSource(trigger.source)
    if (verb === null || provider === null) return false
    const named = scope.connectionId
    if (typeof named === "string" && named !== "")
        return binding.muted.some((entry) => entry.verb === verb && entry.connectionId === named)
    const ofProvider = (entry: TriggerTakesBinding["muted"][number]): boolean => entry.verb === verb && entry.provider === provider
    return binding.muted.some(ofProvider) && !binding.sources.some(ofProvider)
}

/**
 * Whether one trigger takes a wake: the wake arrives as the trigger's kind, is an event of the trigger's VERB (a channel's verb is its
 * channel's) and, for a trigger a stored graph pins to one account, NAMES that account (a wake on another account, or one naming none,
 * wakes nothing), is not muted by the graph's binding (`mutedBy`: the account of a stream the founder did not pick), and meets its
 * conditions. A wake a provider trigger fired is taken only by a trigger registered on that provider trigger, and such a trigger takes no
 * other wake. The verb of the wake is the one its producer's typed members name (`wakeVerbOf`): a care timer is no bank credit and a bank
 * credit no website order, whatever their conditions; a wake no verb is derived for (a plain task, an internal event, another system's
 * tag, a channel line that names no channel) is taken by NO trigger.
 */
export const triggerTakes = (
    trigger: WorkflowTrigger,
    source: string,
    scope: Readonly<Record<string, unknown>>,
    binding?: TriggerTakesBinding,
): boolean => {
    const named = pipelineVerbOf(scope)
    if (named !== null) return pipelineTriggerTakes(trigger, named, scope, binding)
    const road = roadOfSource(trigger.source)
    if (road === null || road !== source) return false
    if (providerTriggerOfWake(scope) !== providerTriggerOf(trigger.source)) return false
    const verb = wakeVerbOf(road, scope)
    if (verb === null || verb !== verbOfSource(trigger.source)) return false
    // A stored trigger pinned to an account (`source.connectionId`) takes only a wake that names it.
    const connectionId = trigger.source.connectionId
    if (connectionId !== null && scope.connectionId !== connectionId) return false
    if (binding !== undefined && mutedBy(trigger, scope, binding)) return false
    return conditionsHold(trigger.conditions, scope)
}

/**
 * The key of the first trigger of a graph that takes a wake, or null; a graph without typed triggers is taken by its sources alone. With
 * the graph's binding to the workspace's accounts (`triggerBindingOf`), a wake of an account it mutes takes nothing.
 */
export const takingTriggerOf = (
    spec: GraphSpec,
    source: string,
    scope: Readonly<Record<string, unknown>>,
    binding?: TriggerTakesBinding,
): string | null => {
    if (spec.triggers === undefined) {
        // A graph from before contracts registered on no provider trigger: it takes every wake of its sources but those.
        const sources: ReadonlyArray<string> = spec.trigger.sources
        return providerTriggerOfWake(scope) === null && sources.includes(source) ? "" : null
    }
    return spec.triggers.find((trigger) => triggerTakes(trigger, source, scope, binding))?.key ?? null
}

/**
 * The verbs a graph's `wait` steps listen for (`core.wait` `params.on[].verb`, a verb is plain data in the stored graph), each once, in
 * the order the steps list them. What makes an event of a verb no head trigger registers reach the agent: a parked run of it may take it.
 */
export const waitVerbsOf = (spec: GraphSpec): ReadonlyArray<string> => [
    ...new Set(
        spec.nodes.flatMap((node) => {
            if (node.step !== TEMPLATE_WAIT_STEP) return []
            const on: unknown = node.params?.on
            if (!Array.isArray(on)) return []
            return on.flatMap((entry: unknown) =>
                isRecord(entry) && typeof entry.verb === "string" && entry.verb !== "" ? [entry.verb] : [],
            )
        }),
    ),
]

/**
 * THE VERBS A GRAPH LISTENS TO: its head triggers' verbs (`verbOfSource` of each typed trigger) and the verbs its `wait` steps list, each
 * once, the heads first. An agent listens to the union over its active workflows: an event of a verb only a wait lists is delivered to
 * the agent so that a parked run may take it, and starts nothing when none does.
 */
export const listenedVerbsOf = (spec: GraphSpec): ReadonlyArray<string> => [
    ...new Set([
        ...(spec.triggers ?? []).flatMap((trigger) => verbOfSource(trigger.source) ?? []),
        ...waitVerbsOf(spec),
    ]),
]
