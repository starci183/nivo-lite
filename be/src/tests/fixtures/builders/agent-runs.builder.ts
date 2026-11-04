import { builder } from "@starci/jest-preset"
import { agentRunsEntities } from "@modules/domain/agent-runs"
import type { RunStepView, RunView, StepSpec, StepView } from "@modules/domain/agent-runs"

const AgentRunEntity: (typeof agentRunsEntities)[0] = agentRunsEntities[0]
const AgentRunStepEntity: (typeof agentRunsEntities)[1] = agentRunsEntities[1]
type AgentRunEntity = InstanceType<typeof AgentRunEntity>
type AgentRunStepEntity = InstanceType<typeof AgentRunStepEntity>

const WHEN = new Date("2026-11-10T03:00:00.000Z")

/** A step as a handler reads it, a read step on its first try unless the test says otherwise. */
export const stepViewOf = (over: Partial<StepView> = {}): StepView => ({
    stepKey: "turn",
    nodeKey: "node-turn",
    kind: "turn",
    effect: { kind: "read" },
    input: {},
    maxAttempts: 3,
    deadlineMs: 120_000,
    runId: "run-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    status: "running",
    attempt: 1,
    fence: 1,
    result: null,
    earlier: {},
    ...over,
})

/** A run that is going on, unless the test says otherwise. */
export const runViewOf = (over: Partial<RunView> = {}): RunView => ({
    id: "run-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    wakeId: "wake-1",
    trigger: "customer_message",
    versionId: null,
    status: "running",
    context: { conversationId: "c-1" },
    errorCode: null,
    spoken: false,
    ...over,
})

/** A step as the trace and the sweep read it. */
export const runStepViewOf = (over: Partial<RunStepView> = {}): RunStepView => ({
    stepKey: "turn",
    nodeKey: "node-turn",
    kind: "turn",
    seq: 1,
    status: "done",
    effect: { kind: "read" },
    attempt: 1,
    errorCode: null,
    result: null,
    waitItemId: null,
    fence: 1,
    ...over,
})

/** A step spec for a tool call. */
export const stepSpecOf = (over: Partial<StepSpec> = {}): StepSpec => ({
    stepKey: "tool-1",
    nodeKey: "node-tool",
    kind: "tool",
    effect: { kind: "read" },
    input: {},
    ...over,
})

/** A run row that is going on, with no trigger context beyond a conversation. */
export const runRowOf: (overrides?: Partial<AgentRunEntity>) => AgentRunEntity = builder<AgentRunEntity>({
    id: "run-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    wakeId: "wake-1",
    trigger: "customer_message",
    versionId: null,
    status: "running",
    context: { conversationId: "c-1" },
    errorCode: null,
    deadLetteredAt: null,
    finishedAt: null,
    parkedBuild: null,
    resumeAttempts: 0,
    resumeNotBefore: null,
    resumedAt: null,
    resumedBy: null,
    resumeReason: null,
    createdAt: WHEN,
    updatedAt: WHEN,
})

/** A step row that is done, the first of run-1. */
export const stepRowOf: (overrides?: Partial<AgentRunStepEntity>) => AgentRunStepEntity = builder<AgentRunStepEntity>({
    id: "s-1",
    runId: "run-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    seq: 1,
    stepKey: "step-1",
    nodeKey: "node",
    kind: "tool",
    effect: { kind: "read" },
    input: {},
    status: "done",
    attempt: 1,
    maxAttempts: 3,
    deadlineMs: 1000,
    fence: 1,
    waitItemId: null,
    result: null,
    errorCode: null,
    notBefore: WHEN,
    claimUntil: null,
    createdAt: WHEN,
    updatedAt: WHEN,
})

/** The run row of a run that waits on a person, on version v-1. */
export const waitingRunRowOf = (): AgentRunEntity => runRowOf({ versionId: "v-1", status: "waiting" })

/** The run row of a run a person was told about. */
export const toldRunRowOf = (): AgentRunEntity => runRowOf({ deadLetteredAt: WHEN })

/** The step row of a step that waits on work item item-1, under its second fence. */
export const waitingStepRowOf = (): AgentRunStepEntity => stepRowOf({ waitItemId: "item-1", fence: 2 })

/** Four step rows in order: a turn that stored a result, a read, a door that is running and a reply that is pending. */
export const chainStepRowsOf = (): ReadonlyArray<AgentRunStepEntity> => [
    stepRowOf({ seq: 1, stepKey: "turn", result: { reply: "hi" } }),
    stepRowOf({ seq: 2, stepKey: "read", result: null }),
    stepRowOf({ seq: 3, stepKey: "door", status: "running", result: null }),
    stepRowOf({ seq: 4, stepKey: "out", status: "pending", result: null }),
]

/** The step row of the second step of run-1, running and waiting on work item item-1. */
export const runningWaitRowOf = (): AgentRunStepEntity =>
    stepRowOf({ id: "s-2", seq: 2, stepKey: "step-2", status: "running", waitItemId: "item-1" })

/** An unbound inbound run whose original adapter facts must survive its first plan binding. */
export const unboundPlanRunRowOf = (): AgentRunEntity =>
    runRowOf({ versionId: null, context: { adapter: "webhook", inbound: { source: "original" } } })

/** Replays that conflict with a prior plan: a different version or an already recorded null binding. */
export const conflictingPlanRunRowsOf = (): ReadonlyArray<AgentRunEntity> => [
    runRowOf({ versionId: "v2", context: {} }),
    runRowOf({ versionId: null, context: { planBinding: { versionId: null, trigger: "tag" } } }),
]

/** A replay of the same immutable plan, keeping the original inbound context and recorded plan payload. */
export const boundPlanRunRowOf = (): AgentRunEntity =>
    runRowOf({
        versionId: "v1",
        context: { planBinding: { versionId: "v1", trigger: "tag", context: { original: true } } },
    })

/** Empty unbound object contexts may bind once, including an already matching version without a binding. */
export const unboundCompatiblePlanRowsOf = (): ReadonlyArray<AgentRunEntity> => [
    runRowOf({ context: {} }),
    runRowOf({ versionId: "v1", context: {} }),
]

/** Malformed or incompatible stored bindings cannot be silently replaced during a replay. */
export const invalidPlanBindingRowsOf = (): ReadonlyArray<AgentRunEntity> => [
    runRowOf({ versionId: "v1", context: { planBinding: "broken" } }),
    runRowOf({ versionId: "v1", context: { planBinding: { versionId: "v2", trigger: "tag" } } }),
    runRowOf({ versionId: "v1", context: { planBinding: { versionId: "v1", trigger: "other" } } }),
]

/** Two links to the same immutable consumer key retain their distinct owner, wait and state facts. */
export const linkedStepRowsOf = (): ReadonlyArray<AgentRunStepEntity> => [
    stepRowOf({
        kind: "reply",
        agentId: "agent-1",
        status: "running",
        waitItemId: "item-1",
        input: { messageId: "m-1" },
    }),
    stepRowOf({ id: "s-2", kind: "reply", agentId: "agent-2", status: "done", input: { messageId: "m-1" } }),
]
