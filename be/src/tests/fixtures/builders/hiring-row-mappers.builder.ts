/** Expected hiring records shared by mapper proofs. */
import { createHash } from "node:crypto"
import type { CandidateRecord, InterviewRecord, JobRecord, OfferRecord } from "@modules/domain/hiring"

/** Deterministic 32-hex hiring link token derived from a fixture label. */
export const LINK_TOKEN = createHash("sha256").update("fixture-hiring-link-token").digest("hex").slice(0, 32)

export const job: JobRecord = {
    id: "job-1",
    workspaceId: "ws-1",
    slug: "barista",
    title: "Barista",
    position: "Coffee maker",
    employmentType: "part_time",
    schedule: "Monday morning",
    payMinVnd: 30000,
    payMaxVnd: 40000,
    payUnit: "hour",
    location: "Main shop",
    headcount: 2,
    description: "Make coffee",
    requirements: {
        skills: ["coffee"],
        experienceYears: 2,
        experienceNote: "Cafe work",
        availability: ["Monday"],
        mustHave: ["Certificate"],
        niceToHave: ["Tea"],
    },
    questions: [{ id: "q-1", text: "Can you make coffee?", type: "yesno", required: true, expect: "yes" }],
    status: "open",
    channels: ["page", "chat"],
    closesAt: "2026-10-20T01:00:00.000Z",
}

export const candidate: CandidateRecord = {
    id: "candidate-1",
    workspaceId: "ws-1",
    jobId: "job-1",
    name: "Alex",
    phone: "0912345678",
    email: "alex@example.test",
    source: "chat",
    conversationId: "conversation-1",
    cvPath: "cv/alex.pdf",
    cvName: "alex.pdf",
    cvMime: "application/pdf",
    answers: [{ questionId: "q-1", question: "Can you make coffee?", answer: "yes" }],
    availability: "Monday morning",
    stage: "shortlisted",
    staffId: "staff-1",
}

export const interview: InterviewRecord = {
    id: "interview-1",
    workspaceId: "ws-1",
    candidateId: "candidate-1",
    jobId: "job-1",
    interviewerUserId: "user-1",
    interviewerName: "Blair",
    mode: "online",
    location: "https://example.test/meet",
    durationMin: 30,
    proposedSlots: [{ start: "2026-10-14T01:00:00.000Z", end: "2026-10-14T01:30:00.000Z" }],
    slotStart: "2026-10-14T01:00:00.000Z",
    slotEnd: "2026-10-14T01:30:00.000Z",
    status: "confirmed",
    token: LINK_TOKEN,
    workItemId: "work-1",
    note: "Bring examples",
}

export const offer: OfferRecord = {
    id: "offer-1",
    workspaceId: "ws-1",
    candidateId: "candidate-1",
    jobId: "job-1",
    terms: {
        title: "Barista",
        pay: "40000 per hour",
        startDate: "2026-10-20",
        probation: "One month",
        note: "Welcome",
    },
    draft: "Letter draft",
    status: "sent",
    token: LINK_TOKEN,
    workItemId: "work-1",
    expiresAt: "2026-10-21T01:00:00.000Z",
}
