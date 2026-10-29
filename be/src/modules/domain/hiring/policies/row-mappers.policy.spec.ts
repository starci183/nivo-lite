import { job } from "../../../../tests/fixtures/builders/hiring-row-mappers.builder"
import { Test } from "@nestjs/testing"
import type { EmploymentType, JobQuestion, JobRequirements, JobStatus, PayUnit } from "../hiring.contracts"
import { STAGES } from "../hiring.contracts"
import type { HiringJobEntity, HiringSettingEntity } from "../persistence/entities"
import {
    isStage as isStageImplementation,
    questionsJson as questionsJsonImplementation,
    requirementsJson as requirementsJsonImplementation,
    toJob as toJobImplementation,
    toSettings as toSettingsImplementation,
} from "./row-mappers.policy"

const CREATED = new Date("2026-10-01T00:00:00.000Z")

/** Overrides of a job entity; the closed-list columns accept any text so fallback cases can be written. */
type JobOverrides = Partial<Omit<HiringJobEntity, "employmentType" | "payUnit" | "status">> & {
    employmentType?: string
    payUnit?: string
    status?: string
}

/** Builds a complete job entity, with overrides for storage fallback cases. */
const jobEntity = (overrides: JobOverrides = {}): HiringJobEntity => {
    const base: HiringJobEntity = {
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
        adVariants: null,
        closesAt: new Date("2026-10-20T08:00:00+07:00"),
        createdBy: null,
        createdAt: CREATED,
        updatedAt: CREATED,
    }
    return Object.assign(base, overrides)
}

const SUBJECT = Symbol("subject")
type Subject = {
    isStage: typeof isStageImplementation
    questionsJson: typeof questionsJsonImplementation
    requirementsJson: typeof requirementsJsonImplementation
    toJob: typeof toJobImplementation
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
                    toJob: toJobImplementation,
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

        const row: HiringSettingEntity = {
            workspaceId: "ws-1",
            publicSlug: "shop",
            retentionDays: 90,
            notifyNewCandidate: true,
            remindInterview: false,
            autoCloseWhenFilled: true,
            applyConsentText: "Consent example",
            adTone: "Friendly",
            updatedAt: new Date("2026-10-01T00:00:00.000Z"),
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

            expect(subject.toJob(jobEntity())).toEqual(job)
        })

        it.each([null, {}])("defaults every missing requirement from %s", async (requirements) => {
            const subject = await buildSubject()

            expect(
                subject.toJob(
                    jobEntity({
                        employmentType: "unknown",
                        payMinVnd: null,
                        payMaxVnd: null,
                        payUnit: "unknown",
                        requirements,
                        questions: null,
                        status: "unknown",
                        closesAt: null,
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
                    jobEntity({
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

            expect(subject.toJob(jobEntity({ status }))).toEqual({ ...job, status })
        })

        it.each(employments)("keeps the %s employment type", async (employmentType) => {
            const subject = await buildSubject()

            expect(subject.toJob(jobEntity({ employmentType }))).toEqual({ ...job, employmentType })
        })

        it.each(payUnits)("keeps the %s pay unit", async (payUnit) => {
            const subject = await buildSubject()

            expect(subject.toJob(jobEntity({ payUnit }))).toEqual({ ...job, payUnit })
        })
    })
})
