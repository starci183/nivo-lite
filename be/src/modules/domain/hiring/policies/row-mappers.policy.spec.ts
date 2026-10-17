import {
    jobRow,
    job,
    candidateRow,
    candidate,
    interviewRow,
    interview,
    offerRow,
    offer,
} from "../../../../tests/fixtures/builders/hiring-row-mappers.builder"
import { Test } from "@nestjs/testing"
import type {
    ApplicationSource,
    EmploymentType,
    InterviewStatus,
    JobQuestion,
    JobRequirements,
    JobStatus,
    OfferStatus,
    OfferTerms,
    PayUnit,
} from "../hiring.contracts"
import { STAGES } from "../hiring.contracts"
import type { HiringSettingsRow } from "../persistence/hiring.rows"
import {
    isStage as isStageImplementation,
    questionsJson as questionsJsonImplementation,
    requirementsJson as requirementsJsonImplementation,
    termsJson as termsJsonImplementation,
    toCandidate as toCandidateImplementation,
    toInterview as toInterviewImplementation,
    toJob as toJobImplementation,
    toOffer as toOfferImplementation,
    toSettings as toSettingsImplementation,
} from "./row-mappers.policy"

const SUBJECT = Symbol("subject")
type Subject = {
    isStage: typeof isStageImplementation
    questionsJson: typeof questionsJsonImplementation
    requirementsJson: typeof requirementsJsonImplementation
    termsJson: typeof termsJsonImplementation
    toCandidate: typeof toCandidateImplementation
    toInterview: typeof toInterviewImplementation
    toJob: typeof toJobImplementation
    toOffer: typeof toOfferImplementation
    toSettings: typeof toSettingsImplementation
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    isStage: isStageImplementation,
                    questionsJson: questionsJsonImplementation,
                    requirementsJson: requirementsJsonImplementation,
                    termsJson: termsJsonImplementation,
                    toCandidate: toCandidateImplementation,
                    toInterview: toInterviewImplementation,
                    toJob: toJobImplementation,
                    toOffer: toOfferImplementation,
                    toSettings: toSettingsImplementation,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const statuses: Array<JobStatus> = ["draft", "open", "paused", "closed"]

const employments: Array<EmploymentType> = ["full_time", "part_time"]

const payUnits: Array<PayUnit> = ["month", "hour", "shift"]

describe("row mappers policy", () => {
    describe("isStage", () => {
        it.each(STAGES)("recognizes the %s stage", async (stage) => {
            const subject = await buildSubject()

            expect(subject.isStage(stage)).toBe(true)
        })

        it.each([undefined, null, 0, false, {}, [], "", "unknown"])("rejects a nonstage %s", async (value) => {
            const subject = await buildSubject()

            expect(subject.isStage(value)).toBe(false)
        })
    })

    it("maps every settings column", async () => {
        const subject = await buildSubject()

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
        expect(subject.toSettings(row)).toEqual({
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
        it("writes snake case keys and copies all lists", async () => {
            const subject = await buildSubject()

            const requirements: JobRequirements = job.requirements
            const result = subject.requirementsJson(requirements)

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
})

describe("row mappers policy", () => {
    describe("questionsJson", () => {
        it("keeps optional fields absent and writes each supported expectation", async () => {
            const subject = await buildSubject()

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
            const result = subject.questionsJson(questions)

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

        it("writes no questions for an empty list", async () => {
            const subject = await buildSubject()

            expect(subject.questionsJson([])).toEqual([])
        })
    })
})

describe("row mappers policy", () => {
    describe("toJob", () => {
        it("maps a complete row with numeric pay and normalized dates", async () => {
            const subject = await buildSubject()

            expect(subject.toJob(jobRow())).toEqual(job)
        })

        it.each([null, {}])("defaults every missing requirement from %s", async (requirements) => {
            const subject = await buildSubject()

            expect(
                subject.toJob(
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
    })
})

describe("row mappers policy", () => {
    describe("toJob", () => {
        it("maps all question types and expectations and drops unsupported expectations", async () => {
            const subject = await buildSubject()

            expect(
                subject.toJob(
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

        it.each(statuses)("keeps the %s job status", async (status) => {
            const subject = await buildSubject()

            expect(subject.toJob(jobRow({ status }))).toEqual({ ...job, status })
        })

        it.each(employments)("keeps the %s employment type", async (employmentType) => {
            const subject = await buildSubject()

            expect(subject.toJob(jobRow({ employment_type: employmentType }))).toEqual({ ...job, employmentType })
        })

        it.each(payUnits)("keeps the %s pay unit", async (payUnit) => {
            const subject = await buildSubject()

            expect(subject.toJob(jobRow({ pay_unit: payUnit }))).toEqual({ ...job, payUnit })
        })
    })
})

describe("row mappers policy", () => {
    describe("toCandidate", () => {
        it("maps every candidate column and answer", async () => {
            const subject = await buildSubject()

            expect(subject.toCandidate(candidateRow())).toEqual(candidate)
        })

        it("defaults an unknown source, unknown stage and null answers", async () => {
            const subject = await buildSubject()

            expect(subject.toCandidate(candidateRow({ source: "unknown", stage: "unknown", answers: null }))).toEqual({
                ...candidate,
                source: "page",
                stage: "applied",
                answers: [],
            })
        })

        const sources: Array<ApplicationSource> = ["page", "chat", "manual"]
        it.each(sources)("keeps the %s application source", async (source) => {
            const subject = await buildSubject()

            expect(subject.toCandidate(candidateRow({ source }))).toEqual({ ...candidate, source })
        })

        it.each(STAGES)("keeps the %s candidate stage", async (stage) => {
            const subject = await buildSubject()

            expect(subject.toCandidate(candidateRow({ stage }))).toEqual({ ...candidate, stage })
        })
    })

    describe("toInterview", () => {
        it("maps every interview column and proposed slot", async () => {
            const subject = await buildSubject()

            expect(subject.toInterview(interviewRow())).toEqual(interview)
        })

        it("defaults mode, slots, dates and status when unavailable", async () => {
            const subject = await buildSubject()

            expect(
                subject.toInterview(
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
        it.each(statuses)("keeps the %s interview status", async (status) => {
            const subject = await buildSubject()

            expect(subject.toInterview(interviewRow({ status }))).toEqual({ ...interview, status })
        })

        it("keeps in person interviews", async () => {
            const subject = await buildSubject()

            expect(subject.toInterview(interviewRow({ mode: "in_person" }))).toEqual({
                ...interview,
                mode: "in_person",
            })
        })
    })
})

describe("row mappers policy", () => {
    describe("termsJson", () => {
        it("writes the complete terms under snake case keys", async () => {
            const subject = await buildSubject()

            const terms: OfferTerms = offer.terms
            expect(subject.termsJson(terms)).toEqual({
                title: "Barista",
                pay: "40000 per hour",
                start_date: "2026-10-20",
                probation: "One month",
                note: "Welcome",
            })
        })
    })

    describe("toOffer", () => {
        it("maps every offer column and term", async () => {
            const subject = await buildSubject()

            expect(subject.toOffer(offerRow())).toEqual(offer)
        })

        it.each([null, {}])("defaults every missing term from %s", async (terms) => {
            const subject = await buildSubject()

            expect(subject.toOffer(offerRow({ terms, status: "unknown", expires_at: null }))).toEqual({
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
        it.each(statuses)("keeps the %s offer status", async (status) => {
            const subject = await buildSubject()

            expect(subject.toOffer(offerRow({ status }))).toEqual({ ...offer, status })
        })
    })
})
