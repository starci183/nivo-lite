import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type {
    RunOpen,
    RunRecord,
    RunView,
    StepRecord,
    StepSpec,
    StepView,
} from "@modules/domain/agent-runs"

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

/** A step spec for a tool call. */
export const stepSpecOf = (over: Partial<StepSpec> = {}): StepSpec => ({
    stepKey: "tool-1",
    nodeKey: "node-tool",
    kind: "tool",
    effect: { kind: "read" },
    input: {},
    ...over,
})

/** The moment the fixtures hold. */
export const WHEN: Date = new Date("2026-11-10T03:00:00.000Z")

/** A run record that is going on, unless the test says otherwise. */
export const runRecordOf = (over: Partial<RunRecord> = {}): RunRecord => ({
    id: "run-1",
    workspaceId: "ws-1",
    version: "3",
    agentId: "agent-1",
    wakeId: "wake-1",
    trigger: "customer_message",
    graphVersionId: null,
    planning: false,
    status: "running",
    context: { conversationId: "c-1" },
    errorCode: null,
    deadLetteredAt: null,
    parkedBuild: null,
    resumeAttempts: 0,
    resumeNotBefore: null,
    endedAt: null,
    startedAt: null,
    stepSeq: 0,
    cancelledAt: null,
    cancelledBy: null,
    ...over,
})

/** A step record that is done, the first of run-1, unless the test says otherwise. */
export const stepRecordOf = (over: Partial<StepRecord> = {}): StepRecord => ({
    id: "s-1",
    version: "2",
    runId: "run-1",
    ordinal: 1,
    stepKey: "step-1",
    nodeKey: "node",
    kind: "tool",
    effect: { kind: "read" },
    input: {},
    result: null,
    status: "done",
    attempt: 1,
    maxAttempts: 3,
    deadlineMs: 1000,
    claimedUntil: null,
    notBefore: WHEN,
    waitItemId: null,
    workItemId: null,
    compAttempts: 0,
    errorCode: null,
    ...over,
})

/** The record row the engine returns for a run record's fields. */
export const runRowOf = (over: Record<string, unknown> = {}, id = "run-1", version = "3"): RecordRow => ({
    id,
    workspaceId: "ws-1",
    version,
    createdAt: WHEN.toISOString(),
    updatedAt: WHEN.toISOString(),
    data: {
        agentId: "agent-1",
        wakeId: "wake-1",
        trigger: "customer_message",
        graphVersionId: null,
        planning: false,
        status: "running",
        context: { conversationId: "c-1" },
        error: null,
        deadLetteredAt: null,
        parkedBuild: null,
        resumeAttempts: 0,
        resumeNotBefore: null,
        endedAt: null,
        stepSeq: 0,
        ...over,
    },
})

/** The record row the engine returns for a step record's fields. */
export const stepRowOf = (over: Record<string, unknown> = {}, id = "s-1", version = "2"): RecordRow => ({
    id,
    workspaceId: "ws-1",
    version,
    createdAt: WHEN.toISOString(),
    updatedAt: WHEN.toISOString(),
    data: {
        runId: "run-1",
        ordinal: 1,
        stepKey: "step-1",
        nodeKey: "node",
        kind: "tool",
        effect: { kind: "read" },
        input: {},
        result: null,
        status: "done",
        attempt: 1,
        maxAttempts: 3,
        deadlineMs: 1000,
        claimedUntil: null,
        notBefore: WHEN.toISOString(),
        waitItemId: null,
        workItemId: null,
        compAttempts: 0,
        errorCode: null,
        ...over,
    },
})

/** The run a tag wakes on a published version of the graph. */
export const OPEN: RunOpen = {
    workspaceId: "ws-1",
    agentId: "agent-1",
    wakeId: "wake-1",
    trigger: "tag",
    versionId: "v-1",
    context: { conversationId: "c-1" },
}
