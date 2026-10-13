import type {
    ApplicationSource,
    CandidateRecord,
    EmploymentType,
    InterviewRecord,
    InterviewStatus,
    JobQuestion,
    JobRecord,
    JobRequirements,
    JobStatus,
    OfferRecord,
    OfferStatus,
    OfferTerms,
    PayUnit,
} from "../hiring.contracts"
import { STAGES } from "../hiring.contracts"
import type {
    HiringCandidatesRow,
    HiringInterviewsRow,
    HiringJobsRow,
    HiringOffersRow,
    HiringSettingsRow,
} from "../persistence/hiring.rows"
import {
    isStage,
    questionsJson,
    requirementsJson,
    termsJson,
    toCandidate,
    toInterview,
    toJob,
    toOffer,
    toSettings,
} from "./row-mappers.policy"

const jobRow = (overrides: Partial<HiringJobsRow> = {}): HiringJobsRow => ({
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

const job: JobRecord = {
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

const candidateRow = (overrides: Partial<HiringCandidatesRow> = {}): HiringCandidatesRow => ({
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

const candidate: CandidateRecord = {
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

const interviewRow = (overrides: Partial<HiringInterviewsRow> = {}): HiringInterviewsRow => ({
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
    token: "0123456789abcdef0123456789abcdef",
    work_item_id: "work-1",
    note: "Bring examples",
    ...overrides,
})

const interview: InterviewRecord = {
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
    token: "0123456789abcdef0123456789abcdef",
    workItemId: "work-1",
    note: "Bring examples",
}

const offerRow = (overrides: Partial<HiringOffersRow> = {}): HiringOffersRow => ({
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
    token: "0123456789abcdef0123456789abcdef",
    work_item_id: "work-1",
    expires_at: "2026-10-21T08:00:00+07:00",
    ...overrides,
})

const offer: OfferRecord = {
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
    token: "0123456789abcdef0123456789abcdef",
    workItemId: "work-1",
    expiresAt: "2026-10-21T01:00:00.000Z",
}

describe("row mappers policy", () => {
    describe("isStage", () => {
        it.each(STAGES)("recognizes the %s stage", (stage) => {
            expect(isStage(stage)).toBe(true)
        })

        it.each([undefined, null, 0, false, {}, [], "", "unknown"])("rejects a nonstage %s", (value) => {
            expect(isStage(value)).toBe(false)
        })
    })

    it("maps every settings column", () => {
        const row: HiringSettingsRow = {
            workspace_id: "ws-1",
            public_slug: "shop",
            retention_days: 90,
            notify_new_candidate: true,
            remind_interview: false,
            auto_close_when_filled: true,
            apply_consent_text: "Consent example",
            ad_tone: "Friendly",
        }
        expect(toSettings(row)).toEqual({
            workspaceId: "ws-1",
            publicSlug: "shop",
            retentionDays: 90,
            notifyNewCandidate: true,
            remindInterview: false,
            autoCloseWhenFilled: true,
            applyConsentText: "Consent example",
            adTone: "Friendly",
        })
    })

    describe("requirementsJson", () => {
        it("writes snake case keys and copies all lists", () => {
            const requirements: JobRequirements = job.requirements
            const result = requirementsJson(requirements)

            expect(result).toEqual({
                skills: ["coffee"],
                experience_years: 2,
                experience_note: "Cafe work",
                availability: ["Monday"],
                must_have: ["Certificate"],
                nice_to_have: ["Tea"],
            })
            expect(result.skills).not.toBe(requirements.skills)
            expect(result.availability).not.toBe(requirements.availability)
            expect(result.must_have).not.toBe(requirements.mustHave)
            expect(result.nice_to_have).not.toBe(requirements.niceToHave)
        })
    })

    describe("questionsJson", () => {
        it("keeps optional fields absent and writes each supported expectation", () => {
            const choice: JobQuestion = {
                id: "choice",
                text: "Day?",
                type: "choice",
                required: true,
                choices: ["Monday", "Tuesday"],
                expect: ["Monday"],
            }
            const questions: Array<JobQuestion> = [
                { id: "text", text: "Experience?", type: "text", required: false },
                { id: "yes", text: "Coffee?", type: "yesno", required: true, expect: "yes" },
                { id: "no", text: "Tea?", type: "yesno", required: false, expect: "no" },
                { id: "number", text: "Years?", type: "number", required: true, expect: 2 },
                choice,
            ]
            const result = questionsJson(questions)

            expect(result).toEqual([
                { id: "text", text: "Experience?", type: "text", required: false },
                { id: "yes", text: "Coffee?", type: "yesno", required: true, expect: "yes" },
                { id: "no", text: "Tea?", type: "yesno", required: false, expect: "no" },
                { id: "number", text: "Years?", type: "number", required: true, expect: 2 },
                choice,
            ])
            const [storedChoice] = result.slice(4)
            const [originalChoice] = questions.slice(4)
            expect(storedChoice?.choices).not.toBe(originalChoice?.choices)
            expect(storedChoice?.expect).not.toBe(originalChoice?.expect)
        })

        it("writes no questions for an empty list", () => {
            expect(questionsJson([])).toEqual([])
        })
    })

    describe("toJob", () => {
        it("maps a complete row with numeric pay and normalized dates", () => {
            expect(toJob(jobRow())).toEqual(job)
        })

        it.each([null, {}])("defaults every missing requirement from %s", (requirements) => {
            expect(
                toJob(
                    jobRow({
                        employment_type: "unknown",
                        pay_min_vnd: null,
                        pay_max_vnd: null,
                        pay_unit: "unknown",
                        requirements,
                        questions: null,
                        status: "unknown",
                        closes_at: null,
                    }),
                ),
            ).toEqual({
                ...job,
                employmentType: "full_time",
                payMinVnd: null,
                payMaxVnd: null,
                payUnit: "month",
                requirements: {
                    skills: [],
                    experienceYears: null,
                    experienceNote: "",
                    availability: [],
                    mustHave: [],
                    niceToHave: [],
                },
                questions: [],
                status: "draft",
                closesAt: null,
            })
        })

        it("maps all question types and expectations and drops unsupported expectations", () => {
            expect(
                toJob(
                    jobRow({
                        questions: [
                            { id: "text", text: "Experience?", type: "text", required: false },
                            { id: "no", text: "Tea?", type: "yesno", required: false, expect: "no" },
                            { id: "number", text: "Years?", type: "number", required: true, expect: 0 },
                            {
                                id: "choice",
                                text: "Day?",
                                type: "choice",
                                required: true,
                                choices: ["Monday"],
                                expect: ["Monday"],
                            },
                            { id: "unknown", text: "Other?", type: "unknown", required: false, expect: "invalid" },
                        ],
                    }),
                ),
            ).toEqual({
                ...job,
                questions: [
                    { id: "text", text: "Experience?", type: "text", required: false },
                    { id: "no", text: "Tea?", type: "yesno", required: false, expect: "no" },
                    { id: "number", text: "Years?", type: "number", required: true, expect: 0 },
                    {
                        id: "choice",
                        text: "Day?",
                        type: "choice",
                        required: true,
                        choices: ["Monday"],
                        expect: ["Monday"],
                    },
                    { id: "unknown", text: "Other?", type: "text", required: false },
                ],
            })
        })

        const statuses: Array<JobStatus> = ["draft", "open", "paused", "closed"]
        it.each(statuses)("keeps the %s job status", (status) => {
            expect(toJob(jobRow({ status }))).toEqual({ ...job, status })
        })

        const employments: Array<EmploymentType> = ["full_time", "part_time"]
        it.each(employments)("keeps the %s employment type", (employmentType) => {
            expect(toJob(jobRow({ employment_type: employmentType }))).toEqual({ ...job, employmentType })
        })

        const payUnits: Array<PayUnit> = ["month", "hour", "shift"]
        it.each(payUnits)("keeps the %s pay unit", (payUnit) => {
            expect(toJob(jobRow({ pay_unit: payUnit }))).toEqual({ ...job, payUnit })
        })
    })

    describe("toCandidate", () => {
        it("maps every candidate column and answer", () => {
            expect(toCandidate(candidateRow())).toEqual(candidate)
        })

        it("defaults an unknown source, unknown stage and null answers", () => {
            expect(toCandidate(candidateRow({ source: "unknown", stage: "unknown", answers: null }))).toEqual({
                ...candidate,
                source: "page",
                stage: "applied",
                answers: [],
            })
        })

        const sources: Array<ApplicationSource> = ["page", "chat", "manual"]
        it.each(sources)("keeps the %s application source", (source) => {
            expect(toCandidate(candidateRow({ source }))).toEqual({ ...candidate, source })
        })

        it.each(STAGES)("keeps the %s candidate stage", (stage) => {
            expect(toCandidate(candidateRow({ stage }))).toEqual({ ...candidate, stage })
        })
    })

    describe("toInterview", () => {
        it("maps every interview column and proposed slot", () => {
            expect(toInterview(interviewRow())).toEqual(interview)
        })

        it("defaults mode, slots, dates and status when unavailable", () => {
            expect(
                toInterview(
                    interviewRow({
                        mode: "unknown",
                        proposed_slots: null,
                        slot_start: null,
                        slot_end: null,
                        status: "unknown",
                    }),
                ),
            ).toEqual({
                ...interview,
                mode: "in_person",
                proposedSlots: [],
                slotStart: null,
                slotEnd: null,
                status: "proposed",
            })
        })

        const statuses: Array<InterviewStatus> = ["proposed", "confirmed", "done", "cancelled", "no_show"]
        it.each(statuses)("keeps the %s interview status", (status) => {
            expect(toInterview(interviewRow({ status }))).toEqual({ ...interview, status })
        })

        it("keeps in person interviews", () => {
            expect(toInterview(interviewRow({ mode: "in_person" }))).toEqual({ ...interview, mode: "in_person" })
        })
    })

    describe("termsJson", () => {
        it("writes the complete terms under snake case keys", () => {
            const terms: OfferTerms = offer.terms
            expect(termsJson(terms)).toEqual({
                title: "Barista",
                pay: "40000 per hour",
                start_date: "2026-10-20",
                probation: "One month",
                note: "Welcome",
            })
        })
    })

    describe("toOffer", () => {
        it("maps every offer column and term", () => {
            expect(toOffer(offerRow())).toEqual(offer)
        })

        it.each([null, {}])("defaults every missing term from %s", (terms) => {
            expect(toOffer(offerRow({ terms, status: "unknown", expires_at: null }))).toEqual({
                ...offer,
                terms: { title: "", pay: "", startDate: "", probation: "", note: "" },
                status: "draft",
                expiresAt: null,
            })
        })

        const statuses: Array<OfferStatus> = [
            "draft",
            "waiting",
            "sent",
            "accepted",
            "declined",
            "expired",
            "cancelled",
        ]
        it.each(statuses)("keeps the %s offer status", (status) => {
            expect(toOffer(offerRow({ status }))).toEqual({ ...offer, status })
        })
    })
})
