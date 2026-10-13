import { builder } from "@starci/jest-preset"
import type { JobQuestionInput, JobRequirementsInput } from "../hiring-operations.contracts"
import { cleanChannels, cleanHeadcount, cleanMoney, cleanQuestions, cleanRequirements } from "./job-input.policy"

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
        it("uses empty requirements when none are supplied", () => {
            expect(cleanRequirements(undefined)).toEqual({
                skills: [],
                experienceYears: null,
                experienceNote: "",
                availability: [],
                mustHave: [],
                niceToHave: [],
            })
        })

        it("trims and bounds every requirement list and note", () => {
            expect(
                cleanRequirements(
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

        it("limits experience to fifty and rejects negative, missing or non-finite years", () => {
            expect(cleanRequirements(requirementsOf({ experienceYears: 51 })).experienceYears).toBe(50)
            expect(cleanRequirements(requirementsOf({ experienceYears: 0 })).experienceYears).toBe(0)
            expect(cleanRequirements(requirementsOf({ experienceYears: -1 })).experienceYears).toBeNull()
            expect(
                cleanRequirements(requirementsOf({ experienceYears: Number.POSITIVE_INFINITY })).experienceYears,
            ).toBeNull()
            expect(cleanRequirements(requirementsOf({ experienceYears: Number.NaN })).experienceYears).toBeNull()
            expect(cleanRequirements(requirementsOf({ experienceYears: null })).experienceYears).toBeNull()
            expect(cleanRequirements(requirementsOf()).experienceYears).toBeNull()
        })
    })

    describe("questions", () => {
        it("cleans each question type and retains valid ids and expected answers", () => {
            expect(
                cleanQuestions([
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

        it("omits unavailable expectations and empty choices", () => {
            expect(
                cleanQuestions([
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

        it("keeps both yes and no expectations and a zero minimum", () => {
            expect(cleanQuestions([questionOf({ type: "yesno", expectYesNo: "yes" })])).toEqual([
                { id: "q1", text: "Question", type: "yesno", required: false, expect: "yes" },
            ])
            expect(cleanQuestions([questionOf({ type: "number", expectNumber: 0 })])).toEqual([
                { id: "q1", text: "Question", type: "number", required: false, expect: 0 },
            ])
        })

        it("drops empty questions before taking twelve and derives their ids after filtering", () => {
            const questions = Array.from({ length: 13 }, (_, index) => questionOf({ text: ` Question ${index} ` }))

            expect(cleanQuestions([questionOf({ text: "  " }), ...questions])).toEqual(
                Array.from({ length: 12 }, (_, index) => ({
                    id: `q${index + 1}`,
                    text: `Question ${index}`,
                    type: "text",
                    required: false,
                })),
            )
            expect(cleanQuestions([])).toEqual([])
        })

        it("bounds question text, choices and choice expectations and rejects invalid ids", () => {
            expect(
                cleanQuestions([
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

    it("keeps known application channels and falls back to the page", () => {
        expect(cleanChannels(undefined)).toEqual(["page", "chat"])
        expect(cleanChannels(["chat", "email", "page"])).toEqual(["chat", "page"])
        expect(cleanChannels(["chat", "chat"])).toEqual(["chat", "chat"])
        expect(cleanChannels(["email"])).toEqual(["page"])
        expect(cleanChannels([])).toEqual(["page"])
    })

    it("rounds non-negative finite money amounts and rejects other values", () => {
        expect(cleanMoney(1234.5)).toBe(1235)
        expect(cleanMoney(0)).toBe(0)
        expect(cleanMoney(-1)).toBeNull()
        expect(cleanMoney(Number.NaN)).toBeNull()
        expect(cleanMoney(Number.POSITIVE_INFINITY)).toBeNull()
        expect(cleanMoney(null)).toBeNull()
        expect(cleanMoney(undefined)).toBeNull()
    })

    it("defaults, rounds and bounds headcount between one and five hundred", () => {
        expect(cleanHeadcount(undefined)).toBe(1)
        expect(cleanHeadcount(0)).toBe(1)
        expect(cleanHeadcount(-5)).toBe(1)
        expect(cleanHeadcount(2.5)).toBe(3)
        expect(cleanHeadcount(501)).toBe(500)
    })
})
