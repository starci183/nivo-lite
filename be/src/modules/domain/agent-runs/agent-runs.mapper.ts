import type { StepView } from "./agent-runs.contracts"
import type { RunStepView, RunView } from "./agent-runs-engine.contracts"
import type { AgentRunEntity, AgentRunStepEntity } from "./persistence/entities"
import type { RouteStep } from "./policies/failure-route.policy"

/** A run row as the engine and the trace read it. */
export const runViewOf = (run: AgentRunEntity): RunView => ({
    id: run.id,
    workspaceId: run.workspaceId,
    agentId: run.agentId,
    wakeId: run.wakeId,
    trigger: run.trigger,
    versionId: run.versionId,
    status: run.status,
    context: Object.fromEntries(Object.entries(run.context)),
    errorCode: run.errorCode,
    spoken: run.deadLetteredAt !== null,
})

/** A step row as the trace and the sweep read it. */
export const stepViewOf = (step: AgentRunStepEntity): RunStepView => ({
    stepKey: step.stepKey,
    nodeKey: step.nodeKey,
    kind: step.kind,
    seq: step.seq,
    status: step.status,
    effect: step.effect,
    attempt: step.attempt,
    errorCode: step.errorCode,
    result: step.result,
    waitItemId: step.waitItemId,
    fence: step.fence,
})

/** The part of a step the failure route reads. */
export const routeStepOf = (step: RunStepView): RouteStep => ({
    stepKey: step.stepKey,
    seq: step.seq,
    status: step.status,
    effect: step.effect,
})

/** Every step of a run as a handler reads it: its own row, and the results of the steps done before it. */
export const handlerViewsOf = (steps: ReadonlyArray<AgentRunStepEntity>): ReadonlyArray<StepView> =>
    steps.map((step) => ({
        stepKey: step.stepKey,
        nodeKey: step.nodeKey,
        kind: step.kind,
        effect: step.effect,
        input: step.input,
        maxAttempts: step.maxAttempts,
        deadlineMs: step.deadlineMs,
        runId: step.runId,
        workspaceId: step.workspaceId,
        agentId: step.agentId,
        status: step.status,
        attempt: step.attempt,
        fence: step.fence,
        result: step.result,
        earlier: Object.fromEntries(
            steps.flatMap((earlier) =>
                earlier.status === "done" && earlier.seq < step.seq && earlier.result !== null
                    ? [[earlier.stepKey, earlier.result] as const]
                    : [],
            ),
        ),
    }))
