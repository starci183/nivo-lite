import { hiringEntities } from "@modules/domain/hiring"
import { CREATED, LINK_TOKEN } from "./hiring-data.builder"

const NOW = "2026-10-15T03:00:00.000Z"
import { entityRowBuilder } from "./entity-row.builder"

type HiringAvailabilityEntity = InstanceType<(typeof hiringEntities)[0]>
/** A stored hiring candidate row. */
export type HiringCandidateEntity = InstanceType<(typeof hiringEntities)[1]>
/** A stored hiring interview row. */
export type HiringInterviewEntity = InstanceType<(typeof hiringEntities)[4]>
type HiringJobEntity = InstanceType<(typeof hiringEntities)[5]>
type HiringOfferEntity = InstanceType<(typeof hiringEntities)[6]>
type HiringSettingEntity = InstanceType<(typeof hiringEntities)[9]>

type SettingsRowShape = {
    readonly workspaceId?: string
    readonly publicSlug?: string
    readonly retentionDays?: number
    readonly notifyNewCandidate?: boolean
    readonly remindInterview?: boolean
    readonly autoCloseWhenFilled?: boolean
    readonly applyConsentText?: string
    readonly adTone?: string
    readonly createdAt?: Date
    readonly updatedAt?: Date
}

export const settingsRow: (changes?: SettingsRowShape) => HiringSettingEntity = entityRowBuilder<HiringSettingEntity>({
    workspaceId: "ws-1",
    publicSlug: "shop",
    retentionDays: 90,
    notifyNewCandidate: true,
    remindInterview: false,
    autoCloseWhenFilled: true,
    applyConsentText: "Consent example",
    adTone: "Friendly",
    updatedAt: CREATED,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
})

type JobRowShape = {
    readonly workspaceId?: string
    readonly slug?: string
    readonly title?: string
    readonly position?: string
    readonly employmentType?: HiringJobEntity["employmentType"]
    readonly schedule?: string
    readonly payMinVnd?: string | null
    readonly payMaxVnd?: string | null
    readonly payUnit?: HiringJobEntity["payUnit"]
    readonly location?: string
    readonly headcount?: number
    readonly description?: string
    readonly requirements?: HiringJobEntity["requirements"]
    readonly questions?: HiringJobEntity["questions"]
    readonly status?: HiringJobEntity["status"]
    readonly channels?: Array<string>
    readonly adVariants?: Record<string, unknown> | null
    readonly closesAt?: Date | null
    readonly createdBy?: string | null
    readonly id?: string
    readonly createdAt?: Date
    readonly updatedAt?: Date
}

export const jobRow: (changes?: JobRowShape) => HiringJobEntity = entityRowBuilder<HiringJobEntity>({
    id: "job-1",
    workspaceId: "ws-1",
    slug: "barista",
    title: "Barista",
    position: "Coffee maker",
    employmentType: "part_time",
    schedule: "Monday morning",
    payMinVnd: "30000",
    payMaxVnd: "40000",
    payUnit: "hour",
    location: "Main shop",
    headcount: 2,
    description: "Make coffee",
    requirements: null,
    questions: null,
    status: "open",
    channels: ["page", "chat"],
    adVariants: null,
    closesAt: new Date("2026-10-20T08:00:00+07:00"),
    createdBy: null,
    createdAt: CREATED,
    updatedAt: CREATED,
})

type CandidateRowShape = {
    readonly workspaceId?: string
    readonly jobId?: string
    readonly name?: string
    readonly phone?: string
    readonly email?: string
    readonly source?: HiringCandidateEntity["source"]
    readonly conversationId?: string | null
    readonly cvPath?: string | null
    readonly cvName?: string | null
    readonly cvMime?: string | null
    readonly cvSize?: number | null
    readonly answers?: HiringCandidateEntity["answers"]
    readonly availability?: string
    readonly score?: number | null
    readonly scoreLabel?: HiringCandidateEntity["scoreLabel"]
    readonly scoreReasons?: HiringCandidateEntity["scoreReasons"]
    readonly scoreSummary?: string | null
    readonly screenedAt?: Date | null
    readonly stage?: HiringCandidateEntity["stage"]
    readonly stageChangedAt?: Date
    readonly rejectedReason?: string | null
    readonly notes?: string
    readonly staffId?: string | null
    readonly id?: string
    readonly createdAt?: Date
    readonly updatedAt?: Date
}

export const candidateRow: (changes?: CandidateRowShape) => HiringCandidateEntity =
    entityRowBuilder<HiringCandidateEntity>({
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
        cvSize: null,
        answers: [{ question_id: "q-1", question: "Experience?", answer: "Two years" }],
        availability: "Monday morning",
        score: null,
        scoreLabel: null,
        scoreReasons: [],
        scoreSummary: null,
        screenedAt: null,
        stage: "applied",
        stageChangedAt: CREATED,
        rejectedReason: null,
        notes: "",
        createdAt: CREATED,
        staffId: null,
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    })

type InterviewRowShape = {
    readonly workspaceId?: string
    readonly candidateId?: string
    readonly jobId?: string
    readonly interviewerUserId?: string | null
    readonly interviewerName?: string
    readonly mode?: "in_person" | "online"
    readonly location?: string
    readonly durationMin?: number
    readonly proposedSlots?: HiringInterviewEntity["proposedSlots"]
    readonly slotStart?: Date | null
    readonly slotEnd?: Date | null
    readonly status?: HiringInterviewEntity["status"]
    readonly token?: string
    readonly workItemId?: string | null
    readonly reminderSentAt?: Date | null
    readonly note?: string
    readonly id?: string
    readonly createdAt?: Date
    readonly updatedAt?: Date
}

export const interviewRow: (changes?: InterviewRowShape) => HiringInterviewEntity =
    entityRowBuilder<HiringInterviewEntity>({
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
        slotStart: new Date("2026-10-14T01:00:00.000Z"),
        slotEnd: new Date("2026-10-14T01:30:00.000Z"),
        status: "confirmed",
        token: LINK_TOKEN,
        workItemId: "work-1",
        reminderSentAt: null,
        note: "Bring examples",
        createdAt: CREATED,
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    })

type OfferRowShape = {
    readonly workspaceId?: string
    readonly candidateId?: string
    readonly jobId?: string
    readonly terms?: HiringOfferEntity["terms"]
    readonly draft?: string
    readonly status?: HiringOfferEntity["status"]
    readonly token?: string
    readonly workItemId?: string | null
    readonly sentVia?: "email" | "chat" | "manual" | null
    readonly sentAt?: Date | null
    readonly expiresAt?: Date | null
    readonly respondedAt?: Date | null
    readonly createdBy?: string | null
    readonly id?: string
    readonly createdAt?: Date
    readonly updatedAt?: Date
}

export const offerRow: (changes?: OfferRowShape) => HiringOfferEntity = entityRowBuilder<HiringOfferEntity>({
    id: "offer-1",
    workspaceId: "ws-1",
    candidateId: "candidate-1",
    jobId: "job-1",
    terms: {
        title: "Barista",
        pay: "40000 per hour",
        probation: "One month",
        note: "Welcome",
        start_date: "2026-10-20",
    },
    draft: "Letter draft",
    status: "sent",
    token: LINK_TOKEN,
    workItemId: "work-1",
    sentVia: null,
    sentAt: null,
    expiresAt: new Date("2026-10-21T08:00:00+07:00"),
    respondedAt: null,
    createdBy: null,
    createdAt: CREATED,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
})

type AvailabilityRowShape = {
    readonly workspaceId?: string
    readonly memberUserId?: string
    readonly weekday?: number
    readonly startMin?: number
    readonly endMin?: number
    readonly id?: string
    readonly createdAt?: Date
    readonly updatedAt?: Date
}

export const availabilityRow: (changes?: AvailabilityRowShape) => HiringAvailabilityEntity =
    entityRowBuilder<HiringAvailabilityEntity>({
        id: "window-1",
        workspaceId: "ws-1",
        memberUserId: "user-1",
        weekday: 1,
        startMin: 480,
        endMin: 720,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    })

export const benchJobRow: (changes?: JobRowShape) => HiringJobEntity = entityRowBuilder<HiringJobEntity>({
    id: "job-1",
    workspaceId: "ws-1",
    slug: "cashier",
    title: "Cashier",
    position: "Counter",
    employmentType: "part_time",
    schedule: "Evenings",
    payMinVnd: "30000",
    payMaxVnd: "40000",
    payUnit: "hour",
    location: "Market",
    headcount: 2,
    description: "Serve customers",
    requirements: {
        skills: ["POS"],
        experience_years: 1,
        experience_note: "Retail",
        availability: ["Evenings"],
        must_have: ["Payments"],
        nice_to_have: ["Stock"],
    },
    questions: [{ id: "q-1", text: "POS?", type: "yesno", required: true, expect: "yes" }],
    status: "open",
    channels: ["page"],
    adVariants: { page: "Join us" },
    closesAt: null,
    createdBy: null,
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
})

export const benchCandidateRow: (changes?: CandidateRowShape) => HiringCandidateEntity =
    entityRowBuilder<HiringCandidateEntity>({
        id: "cand-1",
        workspaceId: "ws-1",
        jobId: "job-1",
        name: "Minh",
        phone: "0901000000",
        email: "minh@example.test",
        source: "page",
        conversationId: null,
        cvPath: "ws-1/cv.pdf",
        cvName: "cv.pdf",
        cvMime: "application/pdf",
        cvSize: 123,
        answers: [{ question_id: "q-1", question: "POS?", answer: "yes" }],
        availability: "Evenings",
        score: 90,
        scoreLabel: "fit",
        scoreReasons: [{ criterion: "POS", status: "met", note: "Yes" }],
        scoreSummary: "Ready",
        screenedAt: new Date(NOW),
        stage: "shortlisted",
        stageChangedAt: new Date(NOW),
        rejectedReason: null,
        notes: "Call",
        staffId: null,
        createdAt: new Date(NOW),
        updatedAt: new Date(NOW),
    })

export const benchInterviewRow: (changes?: InterviewRowShape) => HiringInterviewEntity =
    entityRowBuilder<HiringInterviewEntity>({
        id: "int-1",
        workspaceId: "ws-1",
        candidateId: "cand-1",
        jobId: "job-1",
        interviewerUserId: "u-1",
        interviewerName: "Lan",
        mode: "online",
        location: "https://meet.test",
        durationMin: 30,
        proposedSlots: [{ start: NOW, end: "2026-10-15T03:30:00.000Z" }],
        slotStart: new Date(NOW),
        slotEnd: new Date("2026-10-15T03:30:00.000Z"),
        status: "confirmed",
        token: "token-1",
        workItemId: "work-1",
        reminderSentAt: new Date(NOW),
        note: "Bring CV",
        createdAt: new Date(NOW),
        updatedAt: new Date(NOW),
    })

export const benchOfferRow: (changes?: OfferRowShape) => HiringOfferEntity = entityRowBuilder<HiringOfferEntity>({
    id: "offer-1",
    workspaceId: "ws-1",
    candidateId: "cand-1",
    jobId: "job-1",
    terms: { title: "Cashier", pay: "40000/hour", start_date: "2026-11-01", probation: "1 month", note: "Welcome" },
    draft: "Offer letter",
    status: "accepted",
    token: "offer-token",
    workItemId: "work-2",
    sentVia: "email",
    sentAt: new Date(NOW),
    expiresAt: new Date("2026-11-01T03:00:00.000Z"),
    respondedAt: new Date(NOW),
    createdBy: null,
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
})
