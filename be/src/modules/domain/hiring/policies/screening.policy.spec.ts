import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import type { MessageCatalog } from "@modules/platform/i18n"
import type {
    Answer,
    JobQuestion,
    JobRecord,
    JobRequirements,
    ReasonStatus,
    ScoreLabel,
    ScoreReason,
    ScreenedPerson,
    Screening,
    TextOf,
} from "../hiring.contracts"
import {
    criteriaText as criteriaTextImplementation,
    experienceLine as experienceLineImplementation,
    screenAgainstRequirements as screenAgainstRequirementsImplementation,
} from "./screening.policy"

const SUBJECT = Symbol("subject")
type Subject = typeof import("./screening.policy")
type Params = Readonly<Record<string, string | number>>
type ScreenedJob = Pick<JobRecord, "title" | "requirements" | "questions" | "employmentType" | "schedule" | "location">
type QuestionCase = [title: string, question: Partial<JobQuestion>, answer: string, expected: Screening]
type RequirementCase = [
    title: string,
    requirements: Partial<JobRequirements>,
    person: ScreenedPerson,
    expected: Screening,
]

const text = (key: string, params: Params = {}): string => `${key}${JSON.stringify(params)}`
const requirementsOf = builder<JobRequirements>({
    skills: [],
    experienceYears: null,
    experienceNote: "",
    availability: [],
    mustHave: [],
    niceToHave: [],
})
const jobOf = builder<ScreenedJob>({
    title: "Cashier",
    requirements: requirementsOf(),
    questions: [],
    employmentType: "part_time",
    schedule: "Evenings",
    location: "Main shop",
})
const questionOf = builder<JobQuestion>({ id: "q1", text: "Ready?", type: "yesno", required: true, expect: "yes" })
const answerOf = builder<Answer>({ questionId: "q1", question: "Ready?", answer: "yes" })
const personOf = builder<ScreenedPerson>({ answers: [], availability: "" })
const reasonOf = builder<ScoreReason>({ criterion: "Ready?", status: "met", note: "hiring.screen.yesnoYes{}" })
const screeningOf = builder<Screening>({ score: 0, label: "consider", reasons: [] })
const evidence = (answer: string): ScreenedPerson => personOf({ answers: [answerOf({ answer })] })
const score = (value: number, label: ScoreLabel, ...reasons: Array<ScoreReason>): Screening =>
    screeningOf({ score: value, label, reasons })
const fitting = (...reasons: Array<ScoreReason>): Screening => score(100, "fit", ...reasons)
const notFit = (...reasons: Array<ScoreReason>): Screening => score(0, "not_fit", ...reasons)
const consider = (...reasons: Array<ScoreReason>): Screening => score(0, "consider", ...reasons)
const qr = (status: ReasonStatus, key: string, params: Params = {}, criterion = "Ready?"): ScoreReason =>
    reasonOf({ criterion, status, note: text(`hiring.screen.${key}`, params) })
const rr = (key: string, params: Params, status: ReasonStatus, note: string, noteParams: Params = {}): ScoreReason =>
    reasonOf({
        criterion: text(`hiring.screen.${key}`, params),
        status,
        note: text(`hiring.screen.${note}`, noteParams),
    })
const optionalQuestions = (count: number): Array<JobQuestion> =>
    Array.from({ length: count }, (_, index) => questionOf({ id: `q${index + 1}`, required: false }))
const cafe = `CAF${String.fromCodePoint(0xc9)}`

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    criteriaText: criteriaTextImplementation,
                    experienceLine: experienceLineImplementation,
                    screenAgainstRequirements: screenAgainstRequirementsImplementation,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<Subject>(SUBJECT)

    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const textOf: TextOf = (key, params) => catalog.get(key, params, "vi")
    const check = (job: ScreenedJob, person: ScreenedPerson): Screening =>
        subject.screenAgainstRequirements(job, person, textOf)
    return { catalog, textOf, check, subject }
}

const questionCases: ReadonlyArray<QuestionCase> = [
    ["matching yes", {}, "  YES please  ", fitting(qr("met", "yesnoYes"))],
    ["matching no", { expect: "no" }, "no thanks", fitting(qr("met", "yesnoNoOk"))],
    ["unexpected yes", { expect: "no" }, "ok", notFit(qr("unmet", "yesnoNeedNo"))],
    ["unexpected no", {}, "ko", notFit(qr("unmet", "yesnoNeedYes"))],
    ["unclear yes or no", {}, "maybe", consider(qr("unknown", "yesnoUnclear", { answer: "maybe" }))],
    ["numeric minimum", { type: "number", expect: 2 }, "2 years", fitting(qr("met", "numberOk", { n: 2, need: 2 }))],
    [
        "low numeric answer",
        { type: "number", expect: 2 },
        "1,5 years",
        notFit(qr("unmet", "numberLow", { n: 1.5, need: 2 })),
    ],
    [
        "missing number",
        { type: "number", expect: 2 },
        "several years",
        consider(qr("unknown", "numberNone", { answer: "several years" })),
    ],
    [
        "folded exact text",
        { type: "text", expect: ["cafe"] },
        cafe,
        fitting(qr("met", "choiceOk", { answer: cafe, need: "cafe" })),
    ],
    [
        "escaped choice",
        { type: "choice", expect: ["C++", "Cash"] },
        "I know C++ well",
        fitting(qr("met", "choiceOk", { answer: "I know C++ well", need: "C++, Cash" })),
    ],
    [
        "blank and embedded choices",
        { type: "choice", expect: ["", "Cash"], required: false },
        "supercash",
        notFit(qr("unmet", "choiceBad", { answer: "supercash", need: ", Cash" })),
    ],
    [
        "nonnumeric number expectation",
        { type: "number", expect: ["five"] },
        "five",
        fitting(qr("met", "choiceOk", { answer: "five", need: "five" })),
    ],
    [
        "non-list text expectation",
        { type: "text", expect: "yes", required: false },
        "yes",
        notFit(qr("unmet", "choiceBad", { answer: "yes", need: "" })),
    ],
]

const requirementCases: ReadonlyArray<RequirementCase> = [
    [
        "folded skills, regex escaping and blank skills",
        { skills: ["", "  ", "C++", "Cash", "cafe"] },
        evidence(`C++ Cash ${cafe}`),
        fitting(
            rr("skill", { skill: "C++" }, "met", "skillMet"),
            rr("skill", { skill: "Cash" }, "met", "skillMet"),
            rr("skill", { skill: "cafe" }, "met", "skillMet"),
        ),
    ],
    [
        "protected sentences and embedded skills",
        { skills: ["Cash", "Barista", "stock"] },
        evidence("I know Cash. I am tre trung and know Barista. I use restock."),
        score(
            33,
            "consider",
            rr("skill", { skill: "Cash" }, "met", "skillMet"),
            rr("skill", { skill: "Barista" }, "unknown", "skillUnknown"),
            rr("skill", { skill: "stock" }, "unknown", "skillUnknown"),
        ),
    ],
    [
        "largest years or months value",
        { experienceYears: 3 },
        evidence("Worked 2 nam, 36 thang, 1 year and 30 month"),
        fitting(rr("experience", { years: 3 }, "met", "experienceGot", { years: 3 })),
    ],
    [
        "unrounded comparison and rounded note",
        { experienceYears: 1.3 },
        evidence("Worked 15 month and 1,1 year"),
        notFit(rr("experience", { years: 1.3 }, "unmet", "experienceGot", { years: 1.3 })),
    ],
    [
        "unstated experience",
        { experienceYears: 2 },
        evidence("Experienced cashier in Nam Dinh"),
        consider(rr("experience", { years: 2 }, "unknown", "experienceUnknown")),
    ],
    [
        "absent availability",
        { availability: ["morning", "evening"] },
        personOf({ availability: "  " }),
        consider(rr("availability", { list: "morning, evening" }, "unknown", "availUnknown")),
    ],
    [
        "availability only in answers",
        { availability: ["morning", "evening"] },
        evidence("I can work EVENING shifts"),
        fitting(rr("availability", { list: "morning, evening" }, "met", "availMet", { hits: "evening" })),
    ],
    [
        "availability hits in requirement order",
        { availability: ["morning", "evening"] },
        personOf({ availability: "Evening and morning" }),
        fitting(rr("availability", { list: "morning, evening" }, "met", "availMet", { hits: "morning, evening" })),
    ],
    [
        "unmatched availability and clipped quotation",
        { availability: ["morning"] },
        personOf({ availability: "z".repeat(81) }),
        notFit(rr("availability", { list: "morning" }, "unmet", "availUnmet", { given: "z".repeat(80) })),
    ],
    [
        "sixty-percent tokens and distinct wish weights",
        { mustHave: ["a b 12", "cash stock clear serve close"], niceToHave: ["cash stock greet clean serve"] },
        evidence("Cash stock clear"),
        score(
            67,
            "consider",
            rr("mustHave", { item: "cash stock clear serve close" }, "met", "mentioned"),
            rr("niceToHave", { item: "cash stock greet clean serve" }, "unknown", "notMentioned"),
        ),
    ],
    [
        "unmentioned must-have and mentioned nice-to-have",
        { mustHave: ["stock"], niceToHave: ["cash"] },
        evidence("cash"),
        score(
            33,
            "consider",
            rr("mustHave", { item: "stock" }, "unknown", "notMentioned"),
            rr("niceToHave", { item: "cash" }, "met", "mentioned"),
        ),
    ],
]

describe("screening policy", () => {
    describe("screenAgainstRequirements", () => {
        it("considers applicants without scored requirements and ignores collected questions and blank items", async () => {
            const { catalog, check } = await build()

            expect(
                check(
                    jobOf({
                        questions: [questionOf({ expect: undefined })],
                        requirements: requirementsOf({ skills: ["", "   "], mustHave: ["a b 12"] }),
                    }),
                    evidence("Collected answer"),
                ),
            ).toEqual(consider())
            expect(catalog.get.mock.calls).toEqual([])
        })

        it("marks missing and blank answers unknown and excludes collection-only questions", async () => {
            const { check } = await build()
            const questions = [
                questionOf(),
                questionOf({ id: "q2", text: "Available?", required: false }),
                questionOf({ id: "q3", expect: undefined }),
            ]

            expect(
                check(
                    jobOf({ questions }),
                    personOf({ answers: [answerOf({ answer: "  " }), answerOf({ questionId: "q3" })] }),
                ),
            ).toEqual(consider(qr("unknown", "unanswered"), qr("unknown", "unanswered", {}, "Available?")))
        })

        it.each(questionCases)("scores %s with exact values", async (_title, question, answer, expected) => {
            const { check } = await build()
            expect(check(jobOf({ questions: [questionOf(question)] }), evidence(answer))).toEqual(expected)
        })

        it.each(["co", "vang", "da", "y", "duoc", "dong y", "co a", "co ah", "roi"])(
            "reads affirmative %s",
            async (answer) => {
                const { check } = await build()
                expect(check(jobOf({ questions: [questionOf()] }), evidence(answer))).toEqual(
                    fitting(qr("met", "yesnoYes")),
                )
            },
        )

        it.each(["khong", "k", "n", "chua", "khong co", "khong duoc"])("reads negative %s", async (answer) => {
            const { check } = await build()
            expect(check(jobOf({ questions: [questionOf({ expect: "no" })] }), evidence(answer))).toEqual(
                fitting(qr("met", "yesnoNoOk")),
            )
        })

        it("clips overlong labels and quotations while preserving the exact eighty-character label", async () => {
            const { check } = await build()

            expect(
                check(jobOf({ questions: [questionOf({ text: "Q".repeat(81) })] }), evidence("z".repeat(81))),
            ).toEqual(consider(qr("unknown", "yesnoUnclear", { answer: "z".repeat(80) }, `${"Q".repeat(77)}...`)))
            expect(check(jobOf({ questions: [questionOf({ text: "Q".repeat(80) })] }), evidence("yes"))).toEqual(
                fitting(qr("met", "yesnoYes", {}, "Q".repeat(80))),
            )
        })

        it.each(requirementCases)("scores %s with exact reasons", async (_title, requirements, person, expected) => {
            const { check } = await build()
            expect(check(jobOf({ requirements: requirementsOf(requirements) }), person)).toEqual(expected)
        })
    })
})

describe("screening policy", () => {
    describe("screenAgainstRequirements", () => {
        it.each([null, 0, -1])("omits experience for a minimum of %s", async (years) => {
            const { check } = await build()
            expect(
                check(jobOf({ requirements: requirementsOf({ experienceYears: years }) }), evidence("Worked 4 years")),
            ).toEqual(consider())
        })

        it("avoids counting experience twice when a numeric scored question asks for it", async () => {
            const { check } = await build()

            expect(
                check(
                    jobOf({
                        questions: [questionOf({ text: "Kinh nghiem", type: "number", expect: 2 })],
                        requirements: requirementsOf({ experienceYears: 5 }),
                    }),
                    evidence("3 years"),
                ),
            ).toEqual(fitting(qr("met", "numberOk", { n: 3, need: 2 }, "Kinh nghiem")))
        })

        it("reads experience beside collection-only and unrelated numeric questions", async () => {
            const { check } = await build()
            const questions = [
                questionOf({ id: "q2", text: "Kinh nghiem", type: "number", expect: undefined }),
                questionOf({ text: "Hours", type: "number", expect: 2 }),
            ]

            expect(
                check(jobOf({ questions, requirements: requirementsOf({ experienceYears: 3 }) }), evidence("3 years")),
            ).toEqual(
                fitting(
                    qr("met", "numberOk", { n: 3, need: 2 }, "Hours"),
                    rr("experience", { years: 3 }, "met", "experienceGot", { years: 3 }),
                ),
            )
        })

        it("lets an unmet required question set the label even at seventy-five percent", async () => {
            const { check } = await build()

            expect(
                check(
                    jobOf({
                        questions: [questionOf()],
                        requirements: requirementsOf({ skills: ["cash", "stock", "serve"] }),
                    }),
                    personOf({
                        answers: [
                            answerOf({ answer: "no" }),
                            answerOf({ questionId: "evidence", answer: "cash stock serve" }),
                        ],
                    }),
                ),
            ).toEqual(
                score(
                    75,
                    "not_fit",
                    qr("unmet", "yesnoNeedYes"),
                    rr("skill", { skill: "cash" }, "met", "skillMet"),
                    rr("skill", { skill: "stock" }, "met", "skillMet"),
                    rr("skill", { skill: "serve" }, "met", "skillMet"),
                ),
            )
        })
    })
})

describe("screening policy", () => {
    describe("screenAgainstRequirements", () => {
        it.each<[number, number, ScoreLabel]>([
            [2, 1, "consider"],
            [3, 2, "not_fit"],
        ])(
            "uses the unknown share among %s reasons and %s explicit unmet answers",
            async (count, unmetCount, label) => {
                const { check } = await build()
                const answers = Array.from({ length: unmetCount }, (_, index) =>
                    answerOf({ questionId: `q${index + 1}`, answer: "no" }),
                )
                const unmet = Array.from({ length: unmetCount }, () => qr("unmet", "yesnoNeedYes"))

                expect(check(jobOf({ questions: optionalQuestions(count) }), personOf({ answers }))).toEqual(
                    score(0, label, ...unmet, qr("unknown", "unanswered")),
                )
            },
        )

        it.each<[number, number, ScoreLabel]>([
            [3, 30, "consider"],
            [7, 70, "fit"],
        ])("uses %s met answers for the exact %s score boundary", async (metCount, value, label) => {
            const { check } = await build()
            const answers = Array.from({ length: 10 }, (_, index) =>
                answerOf({ questionId: `q${index + 1}`, answer: index < metCount ? "yes" : "no" }),
            )
            const met = Array.from({ length: metCount }, () => qr("met", "yesnoYes"))
            const unmet = Array.from({ length: 10 - metCount }, () => qr("unmet", "yesnoNeedYes"))

            expect(check(jobOf({ questions: optionalQuestions(10) }), personOf({ answers }))).toEqual(
                score(value, label, ...met, ...unmet),
            )
        })
    })

    describe("experienceLine", () => {
        it("writes positive years with an optional parenthesized note", async () => {
            const { textOf, subject } = await build()

            expect(subject.experienceLine(2, "", "criteria", textOf)).toBe(
                text("hiring.criteria.experienceYears", { years: 2, note: "" }),
            )
            expect(subject.experienceLine(2, "Retail", "facts", textOf)).toBe(
                text("hiring.facts.experienceYears", { years: 2, note: " (Retail)" }),
            )
        })

        it.each([null, 0, -1])("writes a note or nothing for a years value of %s", async (years) => {
            const { textOf, subject } = await build()

            expect(subject.experienceLine(years, "Retail", "criteria", textOf)).toBe(
                text("hiring.criteria.experienceNote", { note: "Retail" }),
            )
            expect(subject.experienceLine(years, "", "criteria", textOf)).toBe("")
            expect(subject.experienceLine(years, "Retail", "facts", textOf)).toBe(
                text("hiring.facts.experienceNote", { note: "Retail" }),
            )
        })
    })
})

describe("screening policy", () => {
    describe("criteriaText", () => {
        it("writes all criterion groups in order", async () => {
            const { textOf, subject } = await build()
            const job = jobOf({
                requirements: requirementsOf({
                    skills: ["Cash", "Stock"],
                    experienceYears: 2,
                    experienceNote: "Retail",
                    availability: ["morning", "evening"],
                    mustHave: ["Operate register", "Serve customers"],
                    niceToHave: ["Train colleagues", "Count stock"],
                }),
            })

            expect(subject.criteriaText(job, textOf)).toBe(
                [
                    text("hiring.criteria.position", {
                        title: "Cashier",
                        where: "hiring.employment.part_time{}, Evenings, Main shop",
                    }),
                    text("hiring.criteria.skills", { list: "Cash, Stock" }),
                    text("hiring.criteria.experienceYears", { years: 2, note: " (Retail)" }),
                    text("hiring.criteria.availability", { list: "morning, evening" }),
                    text("hiring.criteria.mustHave", { list: "Operate register; Serve customers" }),
                    text("hiring.criteria.niceToHave", { list: "Train colleagues; Count stock" }),
                ].join("\n"),
            )
        })

        it("omits empty requirement groups, schedule and location", async () => {
            const { textOf, subject } = await build()

            expect(
                subject.criteriaText(jobOf({ employmentType: "full_time", schedule: "", location: "" }), textOf),
            ).toBe(text("hiring.criteria.position", { title: "Cashier", where: "hiring.employment.full_time{}" }))
        })
    })
})

describe("experience number boundaries", () => {
    it.each(["1,5 years", "18 months", "1.2.1,5 years"])("reads a decimal or month suffix from %s", async (answer) => {
        const { check } = await build()
        expect(check(jobOf({ requirements: requirementsOf({ experienceYears: 1.5 }) }), evidence(answer))).toEqual(
            fitting(rr("experience", { years: 1.5 }, "met", "experienceGot", { years: 1.5 })),
        )
    })
    it("ignores a long numeric near miss with no experience unit", async () => {
        const { check } = await build()
        expect(
            check(jobOf({ requirements: requirementsOf({ experienceYears: 2 }) }), evidence("9".repeat(20000))),
        ).toEqual(consider(rr("experience", { years: 2 }, "unknown", "experienceUnknown")))
    })
})
