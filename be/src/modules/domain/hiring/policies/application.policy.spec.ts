import { Test } from "@nestjs/testing"
import { HiringErrorCode } from "../errors/hiring.error"
import type { JobQuestion, JobStatus } from "../hiring.contracts"
import type { ApplicationInput } from "./application.policy"
import {
    checkApplication as checkApplicationImplementation,
    openingRefusal as openingRefusalImplementation,
} from "./application.policy"

const SUBJECT = Symbol("subject")
type Subject = {
    checkApplication: typeof checkApplicationImplementation
    openingRefusal: typeof openingRefusalImplementation
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    checkApplication: checkApplicationImplementation,
                    openingRefusal: openingRefusalImplementation,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const input = (overrides: Partial<ApplicationInput> = {}): ApplicationInput => ({
    name: "Alex Smith",
    phone: "0912345678",
    email: "",
    availability: "Monday morning",
    consent: true,
    answers: [],
    ...overrides,
})

const questions: Array<JobQuestion> = [
    { id: "required", text: "What is your experience?", type: "text", required: true },
    { id: "optional", text: "Anything else?", type: "text", required: false },
]

describe("application policy", () => {
    describe("openingRefusal", () => {
        const now = new Date("2026-10-13T08:00:00.000Z")

        const statuses: Array<JobStatus> = ["draft", "paused", "closed"]
        it.each(statuses)("refuses a %s job before checking its deadline", async (status) => {
            const subject = await buildSubject()

            expect(subject.openingRefusal({ status, closesAt: "2026-10-12T08:00:00.000Z" }, now)).toEqual({
                code: HiringErrorCode.JobNotOpen,
                params: {},
            })
        })

        it("refuses an open job after its deadline", async () => {
            const subject = await buildSubject()

            expect(subject.openingRefusal({ status: "open", closesAt: "2026-10-13T07:59:59.999Z" }, now)).toEqual({
                code: HiringErrorCode.JobExpired,
                params: {},
            })
        })

        it.each([null, "2026-10-13T08:00:00.000Z", "2026-10-13T08:00:00.001Z", "invalid"])(
            "accepts an open job with deadline %s",
            async (closesAt) => {
                const subject = await buildSubject()

                expect(subject.openingRefusal({ status: "open", closesAt }, now)).toBeNull()
            },
        )
    })
})

describe("application policy", () => {
    describe("checkApplication", () => {
        it("requires consent before checking other fields", async () => {
            const subject = await buildSubject()

            expect(subject.checkApplication({ questions }, input({ consent: false, name: "", phone: "bad" }))).toEqual({
                ok: false,
                refusal: { code: HiringErrorCode.ConsentRequired, params: {} },
            })
        })

        it.each(["", "A", "A".repeat(121)])("refuses an invalid name of length %s", async (name) => {
            const subject = await buildSubject()

            expect(subject.checkApplication({ questions: [] }, input({ name }))).toEqual({
                ok: false,
                refusal: { code: HiringErrorCode.NameInvalid, params: {} },
            })
        })

        it("refuses an invalid phone even when an email is valid", async () => {
            const subject = await buildSubject()

            expect(
                subject.checkApplication({ questions: [] }, input({ phone: "123", email: "alex@example.test" })),
            ).toEqual({
                ok: false,
                refusal: { code: HiringErrorCode.PhoneInvalid, params: {} },
            })
        })

        it.each(["bad", `${"a".repeat(242)}@example.test`])("refuses an invalid email %s", async (email) => {
            const subject = await buildSubject()

            expect(subject.checkApplication({ questions: [] }, input({ email }))).toEqual({
                ok: false,
                refusal: { code: HiringErrorCode.EmailInvalid, params: {} },
            })
        })

        it("requires a contact after trimming both fields", async () => {
            const subject = await buildSubject()

            expect(subject.checkApplication({ questions: [] }, input({ phone: " \t ", email: " \n " }))).toEqual({
                ok: false,
                refusal: { code: HiringErrorCode.ContactRequired, params: {} },
            })
        })

        it("refuses an absent required answer and quotes only the first 80 characters", async () => {
            const subject = await buildSubject()

            const text = "Q".repeat(81)
            expect(
                subject.checkApplication(
                    { questions: [{ id: "required", text, type: "text", required: true }] },
                    input({ answers: [{ questionId: "unknown", answer: "yes" }] }),
                ),
            ).toEqual({
                ok: false,
                refusal: { code: HiringErrorCode.AnswerRequired, params: { question: "Q".repeat(80) } },
            })
        })

        it("refuses a required answer containing only whitespace", async () => {
            const subject = await buildSubject()

            expect(
                subject.checkApplication(
                    { questions },
                    input({ answers: [{ questionId: "required", answer: " \t " }] }),
                ),
            ).toEqual({
                ok: false,
                refusal: { code: HiringErrorCode.AnswerRequired, params: { question: "What is your experience?" } },
            })
        })
    })
})

describe("application policy", () => {
    describe("checkApplication", () => {
        it("normalizes contacts, clips text and keeps answered questions in the job order", async () => {
            const subject = await buildSubject()

            expect(
                subject.checkApplication(
                    { questions },
                    input({
                        name: "  Alex \n Smith \t ",
                        phone: " +84 912 345 678 ",
                        email: " ALEX@EXAMPLE.TEST ",
                        availability: ` ${"a".repeat(301)} `,
                        answers: [
                            { questionId: "unknown", answer: "ignored" },
                            { questionId: "optional", answer: "  Extra  " },
                            { questionId: "required", answer: ` ${"b".repeat(1001)} ` },
                            { questionId: "required", answer: "ignored duplicate" },
                        ],
                    }),
                ),
            ).toEqual({
                ok: true,
                value: {
                    name: "Alex Smith",
                    phone: "0912345678",
                    email: "alex@example.test",
                    availability: "a".repeat(300),
                    answers: [
                        { questionId: "required", question: "What is your experience?", answer: "b".repeat(1000) },
                        { questionId: "optional", question: "Anything else?", answer: "Extra" },
                    ],
                },
            })
        })

        it("omits absent and blank optional answers and accepts only an email", async () => {
            const subject = await buildSubject()

            const optionalQuestions: Array<JobQuestion> = [
                { id: "missing", text: "Missing", type: "text", required: false },
                { id: "blank", text: "Blank", type: "text", required: false },
            ]
            expect(
                subject.checkApplication(
                    { questions: optionalQuestions },
                    input({
                        phone: "",
                        email: "alex@example.test",
                        answers: [{ questionId: "blank", answer: "  " }],
                    }),
                ),
            ).toEqual({
                ok: true,
                value: {
                    name: "Alex Smith",
                    phone: "",
                    email: "alex@example.test",
                    availability: "Monday morning",
                    answers: [],
                },
            })
        })

        it.each(["Al", "A".repeat(120)])("accepts a name at its length boundary %s", async (name) => {
            const subject = await buildSubject()

            expect(subject.checkApplication({ questions: [] }, input({ name }))).toEqual({
                ok: true,
                value: { name, phone: "0912345678", email: "", availability: "Monday morning", answers: [] },
            })
        })
    })
})

describe("application policy", () => {
    describe("checkApplication", () => {
        it("accepts an email at the maximum length", async () => {
            const subject = await buildSubject()

            const email = `${"a".repeat(241)}@example.test`
            expect(subject.checkApplication({ questions: [] }, input({ phone: "", email }))).toEqual({
                ok: true,
                value: { name: "Alex Smith", phone: "", email, availability: "Monday morning", answers: [] },
            })
        })
    })
})
