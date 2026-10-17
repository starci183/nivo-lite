import { createHash } from "node:crypto"
import type {
    HiringCandidatesRow,
    HiringInterviewsRow,
    HiringJobsRow,
    HiringOffersRow,
    HiringSettingsRow,
} from "../../../modules/domain/hiring/persistence/hiring.rows"
/** Deterministic 32-hex hiring link token derived from a fixture label. */
const LINK_TOKEN = createHash("sha256").update("fixture-hiring-link-token").digest("hex").slice(0, 32)
/** Shared, complete test data for the capability cases. */
export const settingsRow: HiringSettingsRow = {
    workspace_id: "ws-1",
    public_slug: "shop",
    retention_days: 90,
    notify_new_candidate: true,
    remind_interview: false,
    auto_close_when_filled: true,
    apply_consent_text: "Consent example",
    ad_tone: "Friendly",
}

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
export const jobRow: HiringJobsRow = {
    id: "job-1",
    workspace_id: "ws-1",
    slug: "barista",
    title: "Barista",
    position: "Coffee maker",
    employment_type: "part_time",
    schedule: "Monday morning",
    pay_min_vnd: "30000",
    pay_max_vnd: "40000",
    pay_unit: "hour",
    location: "Main shop",
    headcount: 2,
    description: "Make coffee",
    requirements: null,
    questions: null,
    status: "open",
    channels: ["page", "chat"],
    closes_at: "2026-10-20T08:00:00+07:00",
}

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
export const candidateRow: HiringCandidatesRow = {
    id: "candidate-1",
    workspace_id: "ws-1",
    job_id: "job-1",
    name: "Alex",
    phone: "0912345678",
    email: "alex@example.test",
    source: "page",
    conversation_id: null,
    cv_path: null,
    cv_name: null,
    cv_mime: null,
    answers: [{ question_id: "q-1", question: "Experience?", answer: "Two years" }],
    availability: "Monday morning",
    stage: "applied",
    staff_id: null,
}

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
export const interviewRow: HiringInterviewsRow = {
    id: "interview-1",
    workspace_id: "ws-1",
    candidate_id: "candidate-1",
    job_id: "job-1",
    interviewer_user_id: "user-1",
    interviewer_name: "Blair",
    mode: "in_person",
    location: "Main shop",
    duration_min: 30,
    proposed_slots: [{ start: "2026-10-14T01:00:00.000Z", end: "2026-10-14T01:30:00.000Z" }],
    slot_start: new Date("2026-10-14T01:00:00.000Z"),
    slot_end: "2026-10-14T01:30:00.000Z",
    status: "confirmed",
    token: LINK_TOKEN,
    work_item_id: "work-1",
    note: "Bring examples",
}

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
export const offerRow: HiringOffersRow = {
    id: "offer-1",
    workspace_id: "ws-1",
    candidate_id: "candidate-1",
    job_id: "job-1",
    terms: { ...offerTerms, start_date: "2026-10-20" },
    draft: "Letter draft",
    status: "sent",
    token: LINK_TOKEN,
    work_item_id: "work-1",
    expires_at: "2026-10-21T08:00:00+07:00",
}

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
