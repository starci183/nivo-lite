import { builder } from "@starci/jest-preset"
import type { ApprovalGate, PerformContext } from "@modules/domain/module-ops"
import type { RequestInterviewParams, SetInterviewStatusParams } from "@modules/domain/hiring"

type ApprovalRequest = Parameters<ApprovalGate["request"]>[0]
/** Shared interview arrangement used by the service cases. */
export const text = (key: string, params: Record<string, string | number> = {}): string =>
    `${key}${JSON.stringify(params)}`
/** Shared interview arrangement used by the service cases. */
export const interviewRequestOf = builder<RequestInterviewParams>({
    candidateId: "candidate-1",
    mode: "in_person",
    location: " Main Street ",
    durationMin: 30,
})
/** Shared interview arrangement used by the service cases. */
export const statusOf = builder<SetInterviewStatusParams>({ id: "interview-1", status: "done" })
/** Shared interview arrangement used by the service cases. */
export const fields = {
    candidate_id: "candidate-1",
    interviewer_user_id: "interviewer-1",
    interviewer_name: "Bob",
    mode: "online",
    location: "https://meeting.example.com",
    duration_min: 30,
}
/** Shared interview arrangement used by the service cases. */
export const contextOf = builder<PerformContext>({
    workspaceId: "ws-1",
    workItemId: "work-1",
    actor: "Manager",
    draft: null,
    fields,
})
/** Shared interview arrangement used by the service cases. */
export const gateOf = builder<ApprovalRequest>({
    workspaceId: "ws-1",
    actor: "Manager",
    action: "schedule_interview",
    subjectType: "candidate",
    subjectId: "candidate-1",
    dedupeKey: "schedule_interview:candidate-1:3",
    summary: text("hiring.interview.summary", { name: "Alice" }),
    fields,
})
