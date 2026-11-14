import { Injectable, Optional } from "@nestjs/common"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import {
    factsOf,
    iterationKeyPartsOf,
    OUTCOME_STEP,
    resolveInput,
    resolveParams,
    splitBindings,
    type MemorySubject,
    type NodeDefinition,
    type ParamBindings,
    type RefScope,
    type StepFailure,
    type StepMemory,
} from "@nivo-lite/agent-sdk/node"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { StepJson, StepView } from "@modules/domain/agent-runs"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { installedStepIn } from "@modules/domain/installed-plugins"
import { LeadMemoryService, contactMemorySubjectOf, memorySubjectOf } from "@modules/domain/lead-memory"
import { InjectClock, type Clock } from "@modules/platform/clock"
import {
    MAIN_WORKFLOW_KEY,
    namespaceOf,
    nodeStepKeyIn,
    nodeStepKeyOf,
    type GraphNodeStepInput,
} from "./policies/graph-flow.policy"

/** What a node runs with once its bindings are resolved: its settings and its data. */
export interface BoundNode {
    /** The settings, for the node's params schema. */
    readonly params: Readonly<Record<string, unknown>>
    /** The data, for the node's input schema. */
    readonly input: Readonly<Record<string, unknown>>
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const isJson = (value: unknown): value is JsonValue =>
    value === null || ["string", "number", "boolean"].includes(typeof value) || Array.isArray(value) || isObject(value)

/** Whether a value is a record of JSON values. */
const isJsonRecord = (value: unknown): value is Readonly<Record<string, JsonValue>> =>
    isObject(value) && Object.values(value).every(isJson)

/** A value as memory keeps it: JSON as it is, anything else as null. */
export const jsonOf = (value: unknown): JsonValue => (isJson(value) ? value : null)

/** How a stored step ended: failed on business grounds, passed over as a side node, else done. */
const statusOf = (error: StepFailure | null, result: StepJson): StepMemory["status"] => {
    if (error !== null) return "failed"
    return result.passedOver === true ? "passed_over" : "done"
}

const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

/** The business failure a stored step result keeps, or null. */
export const failureOfResult = (result: StepJson): StepFailure | null => {
    const error: unknown = result.error
    if (!isObject(error) || typeof error.code !== "string") return null
    return {
        code: error.code,
        messageKey: textOf(error.messageKey) ?? "",
        message: textOf(error.message) ?? "",
        fields: isJsonRecord(error.fields) ? error.fields : {},
    }
}

/**
 * Whether a step done before is seen from the step that runs: every step outside a loop, and a body step of a loop only from outside that
 * loop or from the SAME item of it (inside item k, `steps.<body node>` reads item k's own step or nothing, never another item's).
 */
const seenFrom = (stepKey: string, input: Pick<GraphNodeStepInput, "item" | "loop"> | undefined): boolean => {
    const parts = iterationKeyPartsOf(stepKey)
    if (parts === null || input?.loop === undefined || input.item === undefined || parts.loopKey !== input.loop.nodeKey) return true
    return parts.itemKey === input.item.key
}

/**
 * The outcome of each node done before in this run, by node key, from the results their steps kept (a later item wins outside the
 * loop; inside an item only that item's own body steps are seen).
 */
export const stepsOfRun = (
    step: StepView,
    versionId: string,
    input?: Pick<GraphNodeStepInput, "item" | "loop">,
): Readonly<Record<string, StepMemory>> =>
    Object.fromEntries(
        Object.entries(step.earlier).filter(([key]) => seenFrom(key, input)).map(([key, result]): [string, StepMemory] => {
            const error = failureOfResult(result)
            const output: unknown = result.output
            return [
                nodeStepKeyOf(key),
                {
                    status: statusOf(error, result),
                    output: isJson(output) ? output : null,
                    error,
                    runId: step.runId,
                    versionId,
                    at: "",
                },
            ]
        }),
    )

/** The item key of an `until` round (`r<round>`, until-rounds.policy.ts `roundKeyOf`). */
const ROUND_KEY = /^r([1-9][0-9]{0,3})$/u

/**
 * Inside round r (> 1) of a `loop({ until })` body: the outcome of each body node in round r - 1, by node key (what a ref
 * `{ round: "previous" }` reads, ruling R13: a round sees the round before only, never older ones). Empty in round 1 and outside a body.
 * The thread keeps every round's steps under their own keys (`<loop>[r<n>].<node>`), so the round before stays readable after its step
 * ran again in the round that runs.
 */
export const previousRoundOf = (
    step: StepView,
    versionId: string,
    input?: Pick<GraphNodeStepInput, "item" | "loop">,
): Readonly<Record<string, StepMemory>> => {
    const loop = input?.loop
    const round = input?.item === undefined ? null : ROUND_KEY.exec(input.item.key)
    if (loop === undefined || round === null || Number(round[1]) <= 1) return {}
    const previous = `r${String(Number(round[1]) - 1)}`
    const earlier = Object.fromEntries(
        Object.entries(step.earlier).filter(([key]) => {
            const parts = iterationKeyPartsOf(key)
            return parts !== null && parts.loopKey === loop.nodeKey && parts.itemKey === previous
        }),
    )
    return stepsOfRun({ ...step, earlier }, versionId)
}

/** The values the latest outcome step of the run bound (`output.values`), which `out.*` reads; undefined before any. */
export const outOfRun = (flow: GraphSpec, steps: Readonly<Record<string, StepMemory>>): Readonly<Record<string, JsonValue>> | undefined => {
    const outcomeKeys = new Set(flow.nodes.filter((node) => node.step === OUTCOME_STEP).map((node) => node.key))
    const done = Object.entries(steps).filter(([key, memory]) => outcomeKeys.has(key) && memory.status === "done")
    const last = done.at(-1)?.[1].output
    const values: unknown = isObject(last) ? last.values : undefined
    return isJsonRecord(values) ? values : undefined
}

/**
 * What a graph node runs with: its params (fixed values and refs, the one binding place) resolved against the scope and split between
 * its node's settings and data, with the legacy `input` bindings (`<nodeKey>.<path>`) resolved as before and laid under the data.
 */
export const bindNode = (
    definition: Pick<NodeDefinition, "params" | "input"> | undefined,
    node: GraphSpecNode,
    scope: RefScope,
): BoundNode => {
    const bindings: ParamBindings = node.params ?? {}
    const resolved = resolveParams(bindings, scope)
    const legacy = resolveInput(node.input ?? {}, {
        trigger: scope.trigger,
        steps: Object.fromEntries(Object.entries(scope.steps).map(([key, memory]) => [key, memory.output])),
    })
    return definition === undefined ? { params: resolved, input: legacy } : splitBindings(definition, resolved, legacy)
}

@Injectable()
/**
 * The lead memory as a node step uses it: the scope its refs resolve against (the trigger, the outcomes of this run, the customer's
 * memory across workflows, the element of a for-each iteration, the values of the last outcome), and the write of each outcome with the
 * lead facts it proves. Without the lead-memory capability (an app that does not register it) refs read this run only and nothing is kept.
 */
export class AgentGraphStepMemoryService {
    constructor(
        private readonly nodes: GraphNodeRegistryService,
        @InjectClock() private readonly clock: Clock,
        @Optional() private readonly memory?: LeadMemoryService,
    ) {}

    /**
     * Who a step's run is about, or null for a run about nobody: the trigger's contact, else the contact an earlier step of the run named
     * (`contactId` in its output: the conversation's person became known), else the trigger's conversation.
     */
    subjectOf(step: StepView, input: GraphNodeStepInput): MemorySubject | null {
        const subject = memorySubjectOf(input.trigger)
        if (subject?.contactId !== null) return subject
        const named = Object.values(step.earlier)
            .map((result) => (isObject(result.output) ? textOf(result.output.contactId) : null))
            .find((contactId): contactId is string => contactId !== null)
        return named === undefined ? subject : contactMemorySubjectOf(named, subject.conversationId)
    }

    /** The namespace a step writes under. */
    namespaceOf(flow: GraphSpec, input: GraphNodeStepInput): string {
        return input.namespace ?? namespaceOf(flow.moduleKey, MAIN_WORKFLOW_KEY)
    }

    /** The key memory keeps a step under: its node key, with the loop and the item inside a for-each body (`<loop>[<item>].<node>`). */
    memoryKeyOf(input: GraphNodeStepInput): string {
        return nodeStepKeyIn({ key: input.nodeKey }, input)
    }

    /** The scope a node's refs resolve against. */
    async scopeOf(step: StepView, flow: GraphSpec, input: GraphNodeStepInput): Promise<RefScope> {
        const subject = this.subjectOf(step, input)
        const steps = stepsOfRun(step, input.versionId, input)
        const memory =
            subject === null || this.memory === undefined
                ? null
                : await this.memory.snapshot(step.workspaceId, subject, "step")
        const out = outOfRun(flow, steps)
        const previous = previousRoundOf(step, input.versionId, input)
        const scope = {
            trigger: input.trigger,
            steps,
            namespace: this.namespaceOf(flow, input),
            memory,
            ...(input.item === undefined ? {} : { item: { value: isJson(input.item.value) ? input.item.value : null, index: input.item.index } }),
            ...(out === undefined ? {} : { out }),
            // R13: the body steps of the round before (`RefScope.previous`, what a ref `{ round: "previous" }` reads).
            ...(Object.keys(previous).length === 0 ? {} : { previous }),
        }
        return scope
    }

    /**
     * What a node runs with: its params (fixed values and refs from the one binding place) split between its settings and its data, with
     * the legacy `input` bindings resolved as before and laid under its data.
     */
    bind(node: GraphSpecNode, scope: RefScope): BoundNode {
        return bindNode(this.nodes.installed().nodes.get(node.step), node, scope)
    }

    /**
     * Keeps a step's outcome in the person's memory, with the trigger of the run and the lead facts the node's output proves. A step
     * whose output names the contact of the conversation (`contactId`) moves the conversation's memory to that contact first.
     */
    async remember(
        step: StepView,
        flow: GraphSpec,
        node: GraphSpecNode,
        input: GraphNodeStepInput,
        outcome: Pick<StepMemory, "status" | "output" | "error">,
    ): Promise<void> {
        const found = this.subjectOf(step, input)
        if (found === null || this.memory === undefined) return
        const subject = await this.adopted(step.workspaceId, found, outcome.output)
        // A template node (`defineTemplateNode`) declares its lead facts as a `defineNode` node does: both are read the same way.
        const definition = installedStepIn(this.nodes.installed().nodes, node.step) ?? undefined
        await this.memory.write(step.workspaceId, {
            subject,
            namespace: this.namespaceOf(flow, input),
            workflowId: input.workflowId ?? null,
            agentId: step.agentId,
            nodeKey: this.memoryKeyOf(input),
            step: node.step,
            outcome: { ...outcome, runId: step.runId, versionId: input.versionId, at: this.clock.now().toISOString() },
            facts: outcome.status === "done" ? factsOf(definition, outcome.output) : {},
            trigger: jsonOf(input.trigger),
        })
    }

    /** The subject after a step whose output names a contact while the run is still about a conversation: the contact, memory moved to it. */
    private async adopted(workspaceId: string, subject: MemorySubject, output: unknown): Promise<MemorySubject> {
        const contactId = isObject(output) ? textOf(output.contactId) : null
        if (subject.contactId !== null || contactId === null || subject.conversationId === null || this.memory === undefined)
            return subject
        await this.memory.adopt(workspaceId, subject.conversationId, contactId)
        return contactMemorySubjectOf(contactId, subject.conversationId)
    }
}
