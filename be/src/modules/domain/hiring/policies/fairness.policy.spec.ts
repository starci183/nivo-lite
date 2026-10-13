import { builder } from "@starci/jest-preset"
import type { FairnessCategory, JobDraftTexts } from "../hiring.contracts"
import {
    QUOTED_VIOLATIONS,
    findFairnessViolations,
    scrubProtected,
    stripUnfairLines,
    validateJobDraft,
} from "./fairness.policy"

const draftOf = builder<JobDraftTexts>({
    title: "Cashier",
    description: "Serve customers",
    requirements: {
        skills: [],
        experienceYears: null,
        experienceNote: "",
        availability: [],
        mustHave: [],
        niceToHave: [],
    },
    questions: [],
})

describe("hiring fairness policy", () => {
    it("limits quoted violations to four", () => {
        expect(QUOTED_VIOLATIONS).toBe(4)
    })

    it("finds each protected category in accent-free text", () => {
        const cases: Array<{ text: string; category: FairnessCategory }> = [
            { text: "nu", category: "gender" },
            { text: "20 tuoi", category: "age" },
            { text: "nam sinh", category: "age" },
            { text: "tre trung", category: "age" },
            { text: "ton giao", category: "religion" },
            { text: "dan toc", category: "ethnicity" },
            { text: "doc than", category: "marital" },
            { text: "mang thai", category: "pregnancy" },
            { text: "khuyet tat", category: "disability" },
            { text: "que quan", category: "hometown" },
            { text: "ngoai hinh", category: "appearance" },
        ]

        cases.forEach(({ text, category }) => {
            expect(findFairnessViolations(text, "description")).toEqual([
                { category, excerpt: text, field: "description" },
            ])
        })
    })

    it("matches accented gender rules and deduplicates folded matches at the same position", () => {
        const female = String.fromCodePoint(0x6e, 0x1eef)
        const recruitMen = `tuy${String.fromCodePoint(0x1ec3)}n nam`

        expect(findFairnessViolations(female)).toEqual([{ category: "gender", excerpt: female, field: "" }])
        expect(findFairnessViolations(recruitMen)).toEqual([{ category: "gender", excerpt: recruitMen, field: "" }])
        expect(findFairnessViolations(`nam / ${female}`)).toEqual([
            { category: "gender", excerpt: `nam / ${female}`, field: "" },
            { category: "gender", excerpt: `nam / ${female}`, field: "" },
        ])
    })

    it("preserves original case and normalized accents in quoted context", () => {
        const decomposed = `NU${String.fromCodePoint(0x31b, 0x303)}`
        const normalized = String.fromCodePoint(0x4e, 0x1eee)
        const emoji = String.fromCodePoint(0x1f600)

        expect(findFairnessViolations(`one  two\t${decomposed}  three\nfour five`, "title")).toEqual([
            { category: "gender", excerpt: `one two ${normalized} three four`, field: "title" },
        ])
        expect(findFairnessViolations(`${emoji} nu`)).toEqual([
            { category: "gender", excerpt: `${emoji} nu`, field: "" },
        ])
        expect(findFairnessViolations(`male ${String.fromCodePoint(0x1ea3)}`)).toEqual([
            { category: "gender", excerpt: `male ${String.fromCodePoint(0x1ea3)}`, field: "" },
        ])
        expect(findFairnessViolations(`${String.fromCodePoint(0x301)} nu`)).toEqual([
            { category: "gender", excerpt: `${String.fromCodePoint(0x301)} nu`, field: "" },
        ])
    })

    it("quotes only two whole context words on either side and retains separate occurrences", () => {
        expect(findFairnessViolations("zero one two nu three four five", "skill")).toEqual([
            { category: "gender", excerpt: "one two nu three four", field: "skill" },
        ])
        expect(findFairnessViolations("nu and nu")).toEqual([
            { category: "gender", excerpt: "nu and nu", field: "" },
            { category: "gender", excerpt: "nu and nu", field: "" },
        ])
        expect(findFairnessViolations("nu\t\n")).toEqual([{ category: "gender", excerpt: "nu", field: "" }])
        expect(findFairnessViolations("\t\nnu")).toEqual([{ category: "gender", excerpt: "nu", field: "" }])
    })

    it("keeps excerpts when astral characters outnumber the folded position map", () => {
        const prefix = String.fromCodePoint(0x1f600).repeat(4)

        expect(findFairnessViolations(`${prefix} nu`)).toEqual([
            { category: "gender", excerpt: `${prefix} nu`, field: "" },
        ])
    })

    it("keeps excerpts when lowercasing expands characters before a protected word", () => {
        const prefix = String.fromCodePoint(0x130).repeat(8)

        expect(findFairnessViolations(`${prefix} female`)).toEqual([
            { category: "gender", excerpt: `${prefix} female`, field: "" },
        ])
    })

    it("allows legal minimum ages only with recognized minimum wording", () => {
        expect(findFairnessViolations("tu 18 tuoi")).toEqual([])
        expect(findFairnessViolations("du 16 tuoi")).toEqual([])
        expect(findFairnessViolations("toi thieu 15 tuoi")).toEqual([])
        expect(findFairnessViolations("it nhat 18 tuoi")).toEqual([])
        expect(findFairnessViolations("18 tuoi tro len")).toEqual([])
        expect(findFairnessViolations("duoi 18 tuoi")).toEqual([
            { category: "age", excerpt: "duoi 18 tuoi", field: "" },
        ])
        expect(findFairnessViolations("tu 20 tuoi")).toEqual([{ category: "age", excerpt: "tu 20 tuoi", field: "" }])
        expect(findFairnessViolations("18 tuoi")).toEqual([{ category: "age", excerpt: "18 tuoi", field: "" }])
        expect(findFairnessViolations("17 tuoi tro len")).toEqual([
            { category: "age", excerpt: "17 tuoi tro len", field: "" },
        ])
    })

    it("rejects age ranges even when one end is a legal minimum", () => {
        expect(findFairnessViolations("18-25 tuoi")).toEqual([
            { category: "age", excerpt: "18-25 tuoi", field: "" },
            { category: "age", excerpt: "18-25 tuoi", field: "" },
        ])
        expect(findFairnessViolations("20-18 tuoi tro len")).toEqual([
            { category: "age", excerpt: "20-18 tuoi tro len", field: "" },
        ])
    })

    it("ignores words that merely contain a protected phrase and permitted jewelry context", () => {
        expect(findFairnessViolations("Serve customers with good skills")).toEqual([])
        expect(findFairnessViolations("manual menu nuance ton giaox")).toEqual([])
        expect(findFairnessViolations("nu trang")).toEqual([])
        expect(findFairnessViolations("")).toEqual([])
    })

    it("checks all draft fields, requirements, questions and choices in order", () => {
        expect(
            validateJobDraft(
                draftOf({
                    title: "nu",
                    position: "nu",
                    description: "nu",
                    schedule: "nu",
                    requirements: {
                        skills: ["nu"],
                        experienceYears: 1,
                        experienceNote: "nu",
                        availability: ["nu"],
                        mustHave: ["nu"],
                        niceToHave: ["nu"],
                    },
                    questions: [
                        { id: "a", text: "nu", type: "choice", required: true, choices: ["nu"] },
                        { id: "b", text: "nu", type: "text", required: false },
                    ],
                }),
            ),
        ).toEqual([
            { category: "gender", excerpt: "nu", field: "title" },
            { category: "gender", excerpt: "nu", field: "position" },
            { category: "gender", excerpt: "nu", field: "description" },
            { category: "gender", excerpt: "nu", field: "schedule" },
            { category: "gender", excerpt: "nu", field: "experience" },
            { category: "gender", excerpt: "nu", field: "skill" },
            { category: "gender", excerpt: "nu", field: "availability" },
            { category: "gender", excerpt: "nu", field: "mustHave" },
            { category: "gender", excerpt: "nu", field: "niceToHave" },
            { category: "gender", excerpt: "nu", field: "question" },
            { category: "gender", excerpt: "nu", field: "choice" },
            { category: "gender", excerpt: "nu", field: "question" },
        ])
    })

    it("skips absent and blank draft fields and accepts safe text", () => {
        expect(validateJobDraft(draftOf())).toEqual([])
        expect(validateJobDraft(draftOf({ title: " ", position: " ", description: "", schedule: "\t" }))).toEqual([])
    })

    it("removes whole protected sentences before returning candidate text", () => {
        expect(scrubProtected("  I serve customers. I am nu. I can work evenings!  ")).toBe(
            "I serve customers. I can work evenings!",
        )
        expect(scrubProtected("nu; I work weekends? ton giao\n I can start tomorrow.")).toBe(
            "I work weekends? I can start tomorrow.",
        )
        expect(scrubProtected("nu")).toBe("")
        expect(scrubProtected("")).toBe("")
    })

    it("removes unfair lines and preserves the remaining line breaks", () => {
        expect(stripUnfairLines("\nCashier\nnu\nServe customers\n20 tuoi\n\n")).toBe("Cashier\nServe customers")
        expect(stripUnfairLines("nu\nton giao")).toBe("")
        expect(stripUnfairLines("")).toBe("")
    })
})
