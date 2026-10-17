import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { JobQuestionInput, JobRequirementsInput } from "../hiring-operations.contracts"
import {
    cleanChannels as cleanChannelsImplementation,
    cleanHeadcount as cleanHeadcountImplementation,
    cleanMoney as cleanMoneyImplementation,
    cleanQuestions as cleanQuestionsImplementation,
    cleanRequirements as cleanRequirementsImplementation,
} from "./job-input.policy"

const SUBJECT = Symbol("subject")
type Subject = {
    cleanChannels: typeof cleanChannelsImplementation
    cleanHeadcount: typeof cleanHeadcountImplementation
    cleanMoney: typeof cleanMoneyImplementation
    cleanQuestions: typeof cleanQuestionsImplementation
    cleanRequirements: typeof cleanRequirementsImplementation
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    cleanChannels: cleanChannelsImplementation,
                    cleanHeadcount: cleanHeadcountImplementation,
                    cleanMoney: cleanMoneyImplementation,
                    cleanQuestions: cleanQuestionsImplementation,
                    cleanRequirements: cleanRequirementsImplementation,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const requirementsOf = builder<JobRequirementsInput>({
    skills: [],
    experienceNote: "",
    availability: [],
    mustHave: [],
    niceToHave: [],
})

const questionOf = builder<JobQuestionInput>({ text: "Question", type: "text", required: false })

describe("hiring job input policy", () => {
    describe("requirements", () => {
        it("uses empty requirements when none are supplied", async () => {
            const subject = await buildSubject()

            expect(subject.cleanRequirements(undefined)).toEqual({
                skills: [],
                experienceYears: null,
                experienceNote: "",
                availability: [],
                mustHave: [],
                niceToHave: [],
            })
        })

        it("trims and bounds every requirement list and note", async () => {
            const subject = await buildSubject()

            expect(
                subject.cleanRequirements(
                    requirementsOf({
                        skills: Array.from({ length: 41 }, () => `  ${"s".repeat(201)}  `),
                        experienceYears: 2.5,
                        experienceNote: `  ${"e".repeat(301)}  `,
                        availability: Array.from({ length: 21 }, () => `  ${"a".repeat(81)}  `),
                        mustHave: Array.from({ length: 41 }, () => `  ${"m".repeat(201)}  `),
                        niceToHave: Array.from({ length: 41 }, () => `  ${"n".repeat(201)}  `),
                    }),
                ),
            ).toEqual({
                skills: Array.from({ length: 40 }, () => "s".repeat(200)),
                experienceYears: 2.5,
                experienceNote: "e".repeat(300),
                availability: Array.from({ length: 20 }, () => "a".repeat(80)),
                mustHave: Array.from({ length: 40 }, () => "m".repeat(200)),
                niceToHave: Array.from({ length: 40 }, () => "n".repeat(200)),
            })
        })

        it("limits experience to fifty and rejects negative, missing or non-finite years", async () => {
            const subject = await buildSubject()

            expect(subject.cleanRequirements(requirementsOf({ experienceYears: 51 })).experienceYears).toBe(50)
            expect(subject.cleanRequirements(requirementsOf({ experienceYears: 0 })).experienceYears).toBe(0)
            expect(subject.cleanRequirements(requirementsOf({ experienceYears: -1 })).experienceYears).toBeNull()
            expect(
                subject.cleanRequirements(requirementsOf({ experienceYears: Number.POSITIVE_INFINITY }))
                    .experienceYears,
            ).toBeNull()
            expect(
                subject.cleanRequirements(requirementsOf({ experienceYears: Number.NaN })).experienceYears,
            ).toBeNull()
            expect(subject.cleanRequirements(requirementsOf({ experienceYears: null })).experienceYears).toBeNull()
            expect(subject.cleanRequirements(requirementsOf()).experienceYears).toBeNull()
        })
    })
})

describe("hiring job input policy", () => {
    describe("questions", () => {
        it("cleans each question type and retains valid ids and expected answers", async () => {
            const subject = await buildSubject()

            expect(
                subject.cleanQuestions([
                    questionOf({ id: "valid-ID_2", text: "  Free text  ", required: true }),
                    questionOf({ id: "bad id", text: "  Can work?  ", type: "yesno", expectYesNo: "no" }),
                    questionOf({ text: "  Experience?  ", type: "number", expectNumber: 1.5 }),
                    questionOf({
                        text: "  Pick a shift  ",
                        type: "choice",
                        choices: ["  Morning  ", "", " Evening "],
                        expectChoices: [" Evening ", " "],
                    }),
                ]),
            ).toEqual([
                { id: "valid-ID_2", text: "Free text", type: "text", required: true },
                { id: "q2", text: "Can work?", type: "yesno", required: false, expect: "no" },
                { id: "q3", text: "Experience?", type: "number", required: false, expect: 1.5 },
                {
                    id: "q4",
                    text: "Pick a shift",
                    type: "choice",
                    required: false,
                    choices: ["Morning", "Evening"],
                    expect: ["Evening"],
                },
            ])
        })

        it("omits unavailable expectations and empty choices", async () => {
            const subject = await buildSubject()

            expect(
                subject.cleanQuestions([
                    questionOf({ type: "yesno" }),
                    questionOf({ type: "number" }),
                    questionOf({ type: "number", expectNumber: Number.POSITIVE_INFINITY }),
                    questionOf({ type: "choice" }),
                    questionOf({ type: "choice", choices: [" "], expectChoices: [] }),
                    questionOf({ expectYesNo: "yes", expectNumber: 4, expectChoices: ["ignored"] }),
                ]),
            ).toEqual([
                { id: "q1", text: "Question", type: "yesno", required: false },
                { id: "q2", text: "Question", type: "number", required: false },
                { id: "q3", text: "Question", type: "number", required: false },
                { id: "q4", text: "Question", type: "choice", required: false },
                { id: "q5", text: "Question", type: "choice", required: false, expect: [] },
                { id: "q6", text: "Question", type: "text", required: false },
            ])
        })

        it("keeps both yes and no expectations and a zero minimum", async () => {
            const subject = await buildSubject()

            expect(subject.cleanQuestions([questionOf({ type: "yesno", expectYesNo: "yes" })])).toEqual([
                { id: "q1", text: "Question", type: "yesno", required: false, expect: "yes" },
            ])
            expect(subject.cleanQuestions([questionOf({ type: "number", expectNumber: 0 })])).toEqual([
                { id: "q1", text: "Question", type: "number", required: false, expect: 0 },
            ])
        })
    })
})

describe("hiring job input policy", () => {
    describe("questions", () => {
        it("drops empty questions before taking twelve and derives their ids after filtering", async () => {
            const subject = await buildSubject()

            const questions = Array.from({ length: 13 }, (_, index) => questionOf({ text: ` Question ${index} ` }))

            expect(subject.cleanQuestions([questionOf({ text: "  " }), ...questions])).toEqual(
                Array.from({ length: 12 }, (_, index) => ({
                    id: `q${index + 1}`,
                    text: `Question ${index}`,
                    type: "text",
                    required: false,
                })),
            )
            expect(subject.cleanQuestions([])).toEqual([])
        })

        it("bounds question text, choices and choice expectations and rejects invalid ids", async () => {
            const subject = await buildSubject()

            expect(
                subject.cleanQuestions([
                    questionOf({
                        id: "x".repeat(25),
                        text: `  ${"q".repeat(241)}  `,
                        type: "choice",
                        choices: Array.from({ length: 13 }, () => `  ${"c".repeat(81)}  `),
                        expectChoices: Array.from({ length: 13 }, () => `  ${"e".repeat(81)}  `),
                    }),
                    questionOf({ id: "" }),
                    questionOf({ id: "x".repeat(24) }),
                ]),
            ).toEqual([
                {
                    id: "q1",
                    text: "q".repeat(240),
                    type: "choice",
                    required: false,
                    choices: Array.from({ length: 12 }, () => "c".repeat(80)),
                    expect: Array.from({ length: 12 }, () => "e".repeat(80)),
                },
                { id: "q2", text: "Question", type: "text", required: false },
                { id: "x".repeat(24), text: "Question", type: "text", required: false },
            ])
        })
    })

    it("keeps known application channels and falls back to the page", async () => {
        const subject = await buildSubject()

        expect(subject.cleanChannels(undefined)).toEqual(["page", "chat"])
        expect(subject.cleanChannels(["chat", "email", "page"])).toEqual(["chat", "page"])
        expect(subject.cleanChannels(["chat", "chat"])).toEqual(["chat", "chat"])
        expect(subject.cleanChannels(["email"])).toEqual(["page"])
        expect(subject.cleanChannels([])).toEqual(["page"])
    })

    it("rounds non-negative finite money amounts and rejects other values", async () => {
        const subject = await buildSubject()

        expect(subject.cleanMoney(1234.5)).toBe(1235)
        expect(subject.cleanMoney(0)).toBe(0)
        expect(subject.cleanMoney(-1)).toBeNull()
        expect(subject.cleanMoney(Number.NaN)).toBeNull()
        expect(subject.cleanMoney(Number.POSITIVE_INFINITY)).toBeNull()
        expect(subject.cleanMoney(null)).toBeNull()
        expect(subject.cleanMoney(undefined)).toBeNull()
    })
})

describe("hiring job input policy", () => {
    it("defaults, rounds and bounds headcount between one and five hundred", async () => {
        const subject = await buildSubject()

        expect(subject.cleanHeadcount(undefined)).toBe(1)
        expect(subject.cleanHeadcount(0)).toBe(1)
        expect(subject.cleanHeadcount(-5)).toBe(1)
        expect(subject.cleanHeadcount(2.5)).toBe(3)
        expect(subject.cleanHeadcount(501)).toBe(500)
    })
})
