import { Injectable, Optional } from "@nestjs/common"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import {
    factsOf,
    iterationKeyOf,
    OUTCOME_STEP,
    resolveInput,
    resolveParams,
    splitBindings,
} from "@nivo-lite/agent-sdk/node"
import type { MemorySubject, NodeDefinition, ParamBindings, RefScope, StepFailure, StepMemory } from "@nivo-lite/agent-sdk/node"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { StepJson, StepView } from "@modules/domain/agent-runs"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { LeadMemoryService, leadMemorySubjectOf, memorySubjectOf } from "@modules/domain/lead-memory"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { MAIN_WORKFLOW_KEY, namespaceOf, nodeStepKeyOf } from "./policies/graph-flow.policy"
import type { GraphNodeStepInput } from "./policies/graph-flow.policy"

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

/** The outcome of each node done before in this run, by node key, from the results their steps kept (a later iteration wins). */
export const stepsOfRun = (
    step: StepView,
    versionId: string,
): Readonly<Record<string, StepMemory>> =>
    Object.fromEntries(
        Object.entries(step.earlier).map(([key, result]): [string, StepMemory] => {
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
     * Who a step's run is about, or null for a run about no customer: the trigger's lead, else the lead an earlier step of the run named
     * (`leadId` in its output: the conversation became that lead), else the trigger's conversation.
     */
    subjectOf(step: StepView, input: GraphNodeStepInput): MemorySubject | null {
        const subject = memorySubjectOf(input.trigger)
        if (subject?.leadId !== null) return subject
        const named = Object.values(step.earlier)
            .map((result) => (isObject(result.output) ? textOf(result.output.leadId) : null))
            .find((leadId): leadId is string => leadId !== null)
        return named === undefined ? subject : leadMemorySubjectOf(named, subject.conversationId)
    }

    /** The namespace a step writes under. */
    namespaceOf(flow: GraphSpec, input: GraphNodeStepInput): string {
        return input.namespace ?? namespaceOf(flow.moduleKey, MAIN_WORKFLOW_KEY)
    }

    /** The key memory keeps a step under: its node key, with the iteration inside a for-each body. */
    memoryKeyOf(input: GraphNodeStepInput): string {
        return input.item === undefined ? input.nodeKey : iterationKeyOf(input.nodeKey, input.item.index)
    }

    /** The scope a node's refs resolve against. */
    async scopeOf(step: StepView, flow: GraphSpec, input: GraphNodeStepInput): Promise<RefScope> {
        const subject = this.subjectOf(step, input)
        const steps = stepsOfRun(step, input.versionId)
        const memory =
            subject === null || this.memory === undefined
                ? null
                : await this.memory.snapshot(step.workspaceId, subject, "step")
        const out = outOfRun(flow, steps)
        return {
            trigger: input.trigger,
            steps,
            namespace: this.namespaceOf(flow, input),
            memory,
            ...(input.item === undefined ? {} : { item: { value: isJson(input.item.value) ? input.item.value : null, index: input.item.index } }),
            ...(out === undefined ? {} : { out }),
        }
    }

    /**
     * What a node runs with: its params (fixed values and refs from the one binding place) split between its settings and its data, with
     * the legacy `input` bindings resolved as before and laid under its data.
     */
    bind(node: GraphSpecNode, scope: RefScope): BoundNode {
        return bindNode(this.nodes.installed().nodes.get(node.step), node, scope)
    }

    /**
     * Keeps a step's outcome in the customer's memory, with the trigger of the run and the lead facts the node's output proves. A step
     * whose output names the lead the conversation just became (`leadId`) moves the conversation's memory to that lead first.
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
        const definition = this.nodes.installed().nodes.get(node.step)
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

    /** The subject after a step whose output names a lead while the run is still about a conversation: the lead, memory moved to it. */
    private async adopted(workspaceId: string, subject: MemorySubject, output: unknown): Promise<MemorySubject> {
        const leadId = isObject(output) ? textOf(output.leadId) : null
        if (subject.leadId !== null || leadId === null || subject.conversationId === null || this.memory === undefined)
            return subject
        await this.memory.adopt(workspaceId, subject.conversationId, leadId)
        return leadMemorySubjectOf(leadId, subject.conversationId)
    }
}
