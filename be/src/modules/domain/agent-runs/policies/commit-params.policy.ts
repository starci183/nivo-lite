import type { StepView } from "../agent-runs.contracts"
import type { StepCommit } from "../agent-runs-engine.contracts"
import { secondsOf } from "./agent-runs.policy"

/** The arguments of `agent_step_commit` for what a step did: the run, the step, its fence, then the outcome and what it carries. */
export const commitParameters = (step: StepView, commit: StepCommit): ReadonlyArray<unknown> => {
    const head = [step.runId, step.stepKey, step.fence] as const
    if (commit.kind === "done") {
        return [
            ...head,
            "done",
            JSON.stringify(commit.result),
            null,
            0,
            null,
            null,
            commit.continues === true || commit.next.length > 0,
        ]
    }
    if (commit.kind === "wait") {
        return [...head, "wait", null, null, 0, commit.workItemId, commit.deadlineAt, false]
    }
    if (commit.kind === "retry") {
        return [...head, "retry", null, commit.code, secondsOf(commit.afterMs), null, null, false]
    }
    return [...head, "failed", null, commit.code, 0, null, null, false]
}
