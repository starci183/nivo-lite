import { builder } from "@starci/jest-preset"
import { agentRunsEntities } from "@modules/domain/agent-runs"
import type { RunStepView, RunView, StepSpec, StepView } from "@modules/domain/agent-runs"

const [AgentRunEntity, AgentRunStepEntity] = agentRunsEntities
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
export const runRowOf = builder<AgentRunEntity>({
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
    createdAt: WHEN,
    updatedAt: WHEN,
})

/** A step row that is done, the first of run-1. */
export const stepRowOf = builder<AgentRunStepEntity>({
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
