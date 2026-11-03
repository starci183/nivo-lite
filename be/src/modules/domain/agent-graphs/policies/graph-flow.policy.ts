import type { GraphSpecNode, GraphTagSource } from "@nivo-lite/agent-sdk/graph"
import type { NodeSaga } from "@nivo-lite/agent-sdk/node"
import type { StepEffect, StepJson, StepSpec } from "@modules/domain/agent-runs"
import { tagPayloadOf } from "@modules/domain/agent-work"
import type { AgentWakeContext } from "@modules/domain/agent-work"
import type { Locale } from "@modules/platform/i18n"

/** The step kind a node of a graph runs as. */
export const GRAPH_NODE_STEP_KIND = "graph_node"

/** The trigger step a node graph's run is opened under. */
export const GRAPH_FLOW_TRIGGER = "tag"

/** The language of a turn whose wake names none. */
const DEFAULT_LOCALE: Locale = "vi"

/** A wake as the flow reads it: its source, the context its door wrote and the member behind it. */
export interface FlowWake {
    readonly source: string
    readonly context: AgentWakeContext
    readonly actorMemberId: string | null
}

/** What a graph node step carries: all it needs to run from its row alone. */
export interface GraphNodeStepInput {
    readonly versionId: string
    readonly nodeKey: string
    readonly trigger: StepJson
}

/**
 * Where a wake came from, in the words of a graph's tag trigger: a clock slot is a schedule, an internal event or a system tag a system
 * event, an agent that tagged an agent, a person who wrote in a group a chats group, and a customer message or a tag on a conversation a
 * channel.
 */
export const tagSourceOf = ({ source, context, actorMemberId }: FlowWake): GraphTagSource => {
    if (source === "schedule") return "schedule"
    if (source === "internal" || context.tagSource !== undefined) return "system-event"
    if (context.authorAgentId !== undefined) return "agent"
    if (actorMemberId !== null || context.authorUserId !== undefined) return "chats-group"
    return source === "customer" || context.conversationId !== undefined ? "channel" : "agent"
}

/** A subject written as `<kind>:<id>` (as the tag door keeps it), or null for a label in any other form. */
export const subjectOfLabel = (label: unknown): { readonly kind: string; readonly id: string } | null => {
    if (typeof label !== "string") return null
    const at = label.indexOf(":")
    return at <= 0 || at === label.length - 1 ? null : { kind: label.slice(0, at), id: label.slice(at + 1) }
}

/**
 * The trigger scope the nodes read as `trigger.*`: every member of the wake's flat context as its door wrote it, the subject as
 * `{ kind, id }` when the door wrote it as `<kind>:<id>`, the tag's plain data as `context`, the system source that tagged (or where the wake came from) as `source`, where it came from as `origin`, and the
 * language as `locale`.
 */
export const triggerScopeOf = (wake: FlowWake): StepJson => {
    const members = Object.fromEntries(Object.entries(wake.context).filter(([name]) => name !== "tagContext"))
    const origin = tagSourceOf(wake)
    return {
        ...members,
        subject: subjectOfLabel(wake.context.subject) ?? wake.context.subject ?? null,
        context: tagPayloadOf(wake.context),
        source: wake.context.tagSource ?? origin,
        origin,
        locale: localeOf(members),
    }
}

/** The language of a trigger scope; Vietnamese when it names none the product speaks. */
export const localeOf = (trigger: StepJson): Locale => (trigger.locale === "en" ? "en" : DEFAULT_LOCALE)

/** What a node's step does to the world, in the run engine's terms: a compensable node is undone by the node step itself. */
const stepEffectOf = (saga: NodeSaga): StepEffect => {
    if (saga === "compensable") return { kind: "compensable", compensation: GRAPH_NODE_STEP_KIND }
    return saga === "pivot" ? { kind: "pivot" } : { kind: "read" }
}

/** The step of one graph node in the run, keyed by the node, with the saga kind of the node it runs. */
export const graphNodeStepOf = (node: GraphSpecNode, input: GraphNodeStepInput, saga: NodeSaga): StepSpec => ({
    stepKey: node.key,
    nodeKey: node.key,
    kind: GRAPH_NODE_STEP_KIND,
    effect: stepEffectOf(saga),
    input: { ...input },
})

/** The outputs of the nodes done before, by node key, from the results their steps stored. */
export const outputsOf = (earlier: Readonly<Record<string, StepJson>>): Readonly<Record<string, unknown>> =>
    Object.fromEntries(Object.entries(earlier).map(([key, result]) => [key, result.output]))
