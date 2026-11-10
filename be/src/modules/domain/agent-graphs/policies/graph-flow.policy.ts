import type { GraphSpecNode, GraphTagSource } from "@nivo-lite/agent-sdk/graph"
import { iterationKeyOf, type NodeSaga } from "@nivo-lite/agent-sdk/node"
import type { StepEffect, StepJson, StepSpec } from "@modules/domain/agent-runs"
import { tagPayloadOf } from "@modules/domain/agent-work"
import type { AgentWakeContext } from "@modules/domain/agent-work"
import type { Locale } from "@modules/platform/i18n"
import { suppliedScopeOf } from "./workflow-trigger.policy"

/** The step kind a node of a graph runs as. */
export const GRAPH_NODE_STEP_KIND = "graph_node"

/** The trigger step a node graph's run is opened under. */
export const GRAPH_FLOW_TRIGGER = "tag"

/** The language of a turn whose wake names none. */
const DEFAULT_LOCALE: Locale = "vi"

/** A wake as the flow reads it: its source, the context its door wrote and the member behind it. */
export interface FlowWake {
    /** Where the wake came from, as its door named it. */
    readonly source: string
    /** The context its door wrote. */
    readonly context: AgentWakeContext
    /** The member behind the wake, when a person is. */
    readonly actorMemberId: string | null
}

/** The loop a body step runs in: the for-each node, the iteration and the list (at most the node's `max`, so bounded). */
export interface LoopFrame {
    /** The for-each node. */
    readonly nodeKey: string
    /** The iteration, from 0. */
    readonly index: number
    /** The whole list, in order. */
    readonly items: ReadonlyArray<StepJson[string]>
}

/** What a graph node step carries: all it needs to run from its row alone. */
export interface GraphNodeStepInput {
    /** The published graph version the run was opened on. */
    readonly versionId: string
    /** The node of that version the step runs. */
    readonly nodeKey: string
    /** The trigger scope the node reads as trigger.*. */
    readonly trigger: StepJson
    /** The namespace of the workflow the run executes (`<moduleKey>.<workflowKey>`), under which lead memory keeps its outcomes. */
    readonly namespace?: string | undefined
    /** The workflow the run is pinned to, or null for the agent's own graph. */
    readonly workflowId?: string | null | undefined
    /** Inside a for-each body: the element this iteration works on; memory keys the step `<nodeKey>[<index>]`. */
    readonly item?: { readonly value: StepJson[string]; readonly index: number } | undefined
    /** Inside a for-each body: the loop, the iteration and the list. */
    readonly loop?: LoopFrame | undefined
}

/** The workflow key of the agent's own graph (a run of no workflow), in memory namespaces. */
export const MAIN_WORKFLOW_KEY = "main"

/** The memory namespace of a workflow: `<moduleKey>.<workflowKey>`, the agent's own graph under `main`. */
export const namespaceOf = (moduleKey: string, workflowKey: string | undefined): string =>
    `${moduleKey}.${workflowKey ?? MAIN_WORKFLOW_KEY}`

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
 * The trigger scope the nodes read as `trigger.*`: the params the wake supplies to the workflow's input contract (`suppliedScopeOf`: a
 * hand-off's mapped params and its caller, a tag's plain data, a credit's transaction, the close's slot), every member of the wake's flat context as its door wrote it, the subject as
 * `{ kind, id }` when the door wrote it as `<kind>:<id>`, the tag's plain data as `context`, the system source that tagged (or where the wake came from) as `source`, where it came from as `origin`, and the
 * language as `locale`.
 */
export const triggerScopeOf = (wake: FlowWake): StepJson => {
    const members = Object.fromEntries(Object.entries(wake.context).filter(([name]) => name !== "tagContext"))
    const origin = tagSourceOf(wake)
    const payload = tagPayloadOf(wake.context)
    const subject = subjectOfLabel(wake.context.subject)
    return {
        ...suppliedScopeOf({ members, payload, subject }),
        ...members,
        subject: subject ?? wake.context.subject ?? null,
        context: payload,
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

/** The key of a node's step: the iteration of a body node (`<node>[<index>]`), else the node itself. */
const nodeStepKeyIn = (node: GraphSpecNode, input: GraphNodeStepInput): string =>
    input.item === undefined ? node.key : iterationKeyOf(node.key, input.item.index)

/** The step of one graph node in the run, keyed by the node, with the saga kind of the node it runs. */
export const graphNodeStepOf = (node: GraphSpecNode, input: GraphNodeStepInput, saga: NodeSaga): StepSpec => ({
    stepKey: nodeStepKeyIn(node, input),
    nodeKey: node.key,
    kind: GRAPH_NODE_STEP_KIND,
    effect: stepEffectOf(saga),
    input: { ...input },
})

/** The key of the node a step ran: the step key without the iteration of a for-each body (`<node>[<index>]` → `<node>`). */
export const nodeStepKeyOf = (stepKey: string): string => stepKey.replace(/\[\d+\]$/, "")

/**
 * Whether a node blocks its run when it fails: the graph node's own `blocking` when it says one, else what the node definition says
 * (`defined`), else it blocks. A side node (`blocking: false`: an owner notice, a report) is recorded as failed and the run goes past it.
 */
export const nodeBlocks = (node: GraphSpecNode, defined: boolean | undefined): boolean =>
    (node.blocking ?? defined) !== false

