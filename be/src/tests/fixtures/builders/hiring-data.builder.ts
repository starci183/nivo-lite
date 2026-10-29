import { createHash } from "node:crypto"
import type { WorkspaceMemberEntity } from "@modules/domain/workspace-members"

/** The creation time every fixture row carries. */
export const CREATED = new Date("2026-10-01T00:00:00.000Z")

/** Deterministic 32-hex hiring link token derived from a fixture label. */
export const LINK_TOKEN = createHash("sha256").update("fixture-hiring-link-token").digest("hex").slice(0, 32)
/** Shared, complete test data for the capability cases. */
export const settings = {
    workspaceId: "ws-1",
    publicSlug: "shop",
    retentionDays: 90,
    notifyNewCandidate: true,
    remindInterview: false,
    autoCloseWhenFilled: true,
    applyConsentText: "Consent example",
    adTone: "Friendly",
} as const

/** Shared, complete test data for the capability cases. */
export const job = {
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
        skills: [],
        experienceYears: null,
        experienceNote: "",
        availability: [],
        mustHave: [],
        niceToHave: [],
    },
    questions: [],
    status: "open",
    channels: ["page", "chat"],
    closesAt: "2026-10-20T01:00:00.000Z",
} as const

/** Shared, complete test data for the capability cases. */
export const candidate = {
    id: "candidate-1",
    workspaceId: "ws-1",
    jobId: "job-1",
    name: "Alex",
    phone: "0912345678",
    email: "alex@example.test",
    source: "page",
    conversationId: null,
    cvPath: null,
    cvName: null,
    cvMime: null,
    answers: [{ questionId: "q-1", question: "Experience?", answer: "Two years" }],
    availability: "Monday morning",
    stage: "applied",
    staffId: null,
} as const

/** Shared, complete test data for the capability cases. */
export const interview = {
    id: "interview-1",
    workspaceId: "ws-1",
    candidateId: "candidate-1",
    jobId: "job-1",
    interviewerUserId: "user-1",
    interviewerName: "Blair",
    mode: "in_person",
    location: "Main shop",
    durationMin: 30,
    proposedSlots: [{ start: "2026-10-14T01:00:00.000Z", end: "2026-10-14T01:30:00.000Z" }],
    slotStart: "2026-10-14T01:00:00.000Z",
    slotEnd: "2026-10-14T01:30:00.000Z",
    status: "confirmed",
    token: LINK_TOKEN,
    workItemId: "work-1",
    note: "Bring examples",
} as const

/** Terms shared by the persisted and public offer fixtures. */
const offerTerms = { title: "Barista", pay: "40000 per hour", probation: "One month", note: "Welcome" }

/** Shared, complete test data for the capability cases. */
export const offer = {
    id: "offer-1",
    workspaceId: "ws-1",
    candidateId: "candidate-1",
    jobId: "job-1",
    terms: { ...offerTerms, startDate: "2026-10-20" },
    draft: "Letter draft",
    status: "sent",
    token: LINK_TOKEN,
    workItemId: "work-1",
    expiresAt: "2026-10-21T01:00:00.000Z",
} as const

/** An active seat of a member of the workspace, with the fields a spec changes. */
export const memberEntity = (changes: Partial<WorkspaceMemberEntity> = {}): WorkspaceMemberEntity => ({
    id: "seat-1",
    workspaceId: "ws-1",
    userId: "user-1",
    role: "manager",
    staffId: null,
    displayName: "Blair",
    status: "active",
    createdAt: CREATED,
    ...changes,
})
