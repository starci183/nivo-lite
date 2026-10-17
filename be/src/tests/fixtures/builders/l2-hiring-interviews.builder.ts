import { createHash } from "node:crypto"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import type { CredentialPrincipal } from "@modules/domain/identity"
import { text, interviewRequestOf } from "@tests/fixtures/builders/hiring.builder"
import { builder } from "@starci/jest-preset"
import type { CandidateRecord, InterviewRecord } from "@modules/domain/hiring"

/** Shared L2 service proof fixture. */
export const TOKEN = createHash("sha256").update("fixture-hiring-interview-token").digest("hex").slice(0, 32)
/** Shared L2 service proof fixture. */
export const candidateOf = builder<CandidateRecord>({
    id: "candidate-1",
    workspaceId: "ws-1",
    jobId: "job-1",
    name: "Alice",
    phone: "0901234567",
    email: "alice@example.com",
    source: "page",
    conversationId: null,
    cvPath: null,
    cvName: null,
    cvMime: null,
    answers: [],
    availability: "Monday",
    stage: "shortlisted",
    staffId: null,
})
/** Shared L2 service proof fixture. */
export const slot: InterviewRecord["proposedSlots"][number] = {
    start: "2026-10-12T02:00:00.000Z",
    end: "2026-10-12T02:30:00.000Z",
}
/** Shared L2 service proof fixture. */
export const interviewOf = builder<InterviewRecord>({
    id: "interview-1",
    workspaceId: "ws-1",
    candidateId: "candidate-1",
    jobId: "job-1",
    interviewerUserId: "interviewer-1",
    interviewerName: "Bob",
    mode: "in_person",
    location: "Main Street",
    durationMin: 30,
    proposedSlots: [slot],
    slotStart: slot.start,
    slotEnd: slot.end,
    status: "proposed",
    token: TOKEN,
    workItemId: "work-1",
    note: "Candidate note",
})
/** Shared L2 service proof fixture. */
export const roleCall = ["user-1", "ws-1", ["owner", "manager"]]
/** Shared L2 service proof fixture. */
export const when = `when:${slot.start}`
/** Shared L2 service proof fixture. */
export const confirmArgs = [TOKEN, slot.start, slot.end, text("hiring.event.interviewConfirmed", { when })]
/** Shared L2 service proof fixture. */
export const defaultSlots = [
    slot,
    { start: "2026-10-13T02:00:00.000Z", end: "2026-10-13T02:30:00.000Z" },
    { start: "2026-10-14T02:00:00.000Z", end: "2026-10-14T02:30:00.000Z" },
]
/** Shared L2 service proof fixture. */
export const declaredSlots = [
    slot,
    { start: "2026-10-19T02:00:00.000Z", end: "2026-10-19T02:30:00.000Z" },
    { start: "2026-10-26T02:00:00.000Z", end: "2026-10-26T02:30:00.000Z" },
]

/** The manager admitted for interview operations. */
export const interviewMember: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "manager",
    staffId: null,
    displayName: "Manager",
    status: "active",
}

/** Foreign identities rejected by the stored interview link. */
export const mismatchedInterviewPrincipals: Array<CredentialPrincipal> = [
    { kind: "api-key", subject: "interview-1", workspaceId: "ws-1" },
    { kind: "link-token", subject: "foreign-record", workspaceId: "ws-1" },
    { kind: "link-token", subject: "interview-1", workspaceId: "foreign-workspace" },
]

/** Duration bounds and explicit interviewer requests. */
export const interviewDurationCases = [
    { request: interviewRequestOf({ durationMin: 0 }), expected: 30 },
    { request: interviewRequestOf({ durationMin: -1 }), expected: 15 },
    { request: interviewRequestOf({ durationMin: 181 }), expected: 180 },
    { request: interviewRequestOf({ durationMin: 45 }), expected: 45 },
    {
        request: interviewRequestOf({
            interviewerUserId: "member-2",
            mode: "online",
            location: ` ${"x".repeat(301)} `,
        }),
        expected: 30,
    },
]
