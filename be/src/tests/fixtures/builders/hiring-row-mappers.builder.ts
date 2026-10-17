/** Typed hiring row inputs and expected records shared by mapper proofs. */
import { createHash } from "node:crypto"
import type { CandidateRecord, InterviewRecord, JobRecord, OfferRecord } from "@modules/domain/hiring"
import type {
    HiringCandidatesRow,
    HiringInterviewsRow,
    HiringJobsRow,
    HiringOffersRow,
} from "../../../modules/domain/hiring/persistence/hiring.rows"
/** Deterministic 32-hex hiring link token derived from a fixture label. */
const LINK_TOKEN = createHash("sha256").update("fixture-hiring-link-token").digest("hex").slice(0, 32)

/** Builds a complete raw job row, with overrides for storage fallback cases. */
export const jobRow = (overrides: Partial<HiringJobsRow> = {}): HiringJobsRow => ({
    id: "job-1",
    workspace_id: "ws-1",
    slug: "barista",
    title: "Barista",
    position: "Coffee maker",
    employment_type: "part_time",
    schedule: "Monday morning",
    pay_min_vnd: "30000",
    pay_max_vnd: 40000,
    pay_unit: "hour",
    location: "Main shop",
    headcount: 2,
    description: "Make coffee",
    requirements: {
        skills: ["coffee"],
        experience_years: 2,
        experience_note: "Cafe work",
        availability: ["Monday"],
        must_have: ["Certificate"],
        nice_to_have: ["Tea"],
    },
    questions: [{ id: "q-1", text: "Can you make coffee?", type: "yesno", required: true, expect: "yes" }],
    status: "open",
    channels: ["page", "chat"],
    closes_at: "2026-10-20T08:00:00+07:00",
    ...overrides,
})

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

/** Builds a complete raw candidate row, with overrides for source and stage cases. */
export const candidateRow = (overrides: Partial<HiringCandidatesRow> = {}): HiringCandidatesRow => ({
    id: "candidate-1",
    workspace_id: "ws-1",
    job_id: "job-1",
    name: "Alex",
    phone: "0912345678",
    email: "alex@example.test",
    source: "chat",
    conversation_id: "conversation-1",
    cv_path: "cv/alex.pdf",
    cv_name: "alex.pdf",
    cv_mime: "application/pdf",
    answers: [{ question_id: "q-1", question: "Can you make coffee?", answer: "yes" }],
    availability: "Monday morning",
    stage: "shortlisted",
    staff_id: "staff-1",
    ...overrides,
})

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

/** Builds a complete raw interview row, with overrides for date and status cases. */
export const interviewRow = (overrides: Partial<HiringInterviewsRow> = {}): HiringInterviewsRow => ({
    id: "interview-1",
    workspace_id: "ws-1",
    candidate_id: "candidate-1",
    job_id: "job-1",
    interviewer_user_id: "user-1",
    interviewer_name: "Blair",
    mode: "online",
    location: "https://example.test/meet",
    duration_min: 30,
    proposed_slots: [{ start: "2026-10-14T01:00:00.000Z", end: "2026-10-14T01:30:00.000Z" }],
    slot_start: new Date("2026-10-14T01:00:00.000Z"),
    slot_end: "2026-10-14T01:30:00.000Z",
    status: "confirmed",
    token: LINK_TOKEN,
    work_item_id: "work-1",
    note: "Bring examples",
    ...overrides,
})

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

/** Builds a complete raw offer row, with overrides for terms and expiry cases. */
export const offerRow = (overrides: Partial<HiringOffersRow> = {}): HiringOffersRow => ({
    id: "offer-1",
    workspace_id: "ws-1",
    candidate_id: "candidate-1",
    job_id: "job-1",
    terms: {
        title: "Barista",
        pay: "40000 per hour",
        start_date: "2026-10-20",
        probation: "One month",
        note: "Welcome",
    },
    draft: "Letter draft",
    status: "sent",
    token: LINK_TOKEN,
    work_item_id: "work-1",
    expires_at: "2026-10-21T08:00:00+07:00",
    ...overrides,
})

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
