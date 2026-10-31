import { Test } from "@nestjs/testing"
import {
    addDays,
    dateIn,
    dateOfSource,
    foldText,
    foldKeepLength,
    isoDate,
    refOfSource,
    stateOfSource,
} from "./document-state.policy"

const SUBJECT = Symbol("document-state.policy")
type Subject = {
    addDays: typeof addDays
    dateIn: typeof dateIn
    dateOfSource: typeof dateOfSource
    foldText: typeof foldText
    foldKeepLength: typeof foldKeepLength
    isoDate: typeof isoDate
    refOfSource: typeof refOfSource
    stateOfSource: typeof stateOfSource
}
const subjectOf = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    addDays,
                    dateIn,
                    dateOfSource,
                    foldText,
                    foldKeepLength,
                    isoDate,
                    refOfSource,
                    stateOfSource,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const source = (title: string, tags: ReadonlyArray<string> = [], origin: string | null = null) => ({
    title,
    tags,
    origin,
})

describe("foldText", () => {
    it("removes accents, folds the stroked d, lowers case and collapses whitespace", async () => {
        const subject = await subjectOf()
        expect(subject.foldText("  V\u1ed1n  \u0110I\u1ec0U   L\u1ec6 ")).toBe("von dieu le")
    })

    it("keeps one character per input character so indexes line up", async () => {
        const subject = await subjectOf()
        const text = "\u0110i\u1ec1u l\u1ec7"
        expect(subject.foldKeepLength(text)).toHaveLength(text.length)
        expect(subject.foldKeepLength(text)).toBe("dieu le")
    })
})

describe("refOfSource", () => {
    it("reads the number of a dossier tag without leading zeros", async () => {
        const subject = await subjectOf()
        expect(subject.refOfSource(source("x", ["a", "dossier:007"]))).toBe("7")
    })

    it("falls back to the number a title starts with", async () => {
        const subject = await subjectOf()
        expect(subject.refOfSource(source("08. Report", ["dossier:x"]))).toBe("8")
    })

    it("answers null when neither names a dossier", async () => {
        const subject = await subjectOf()
        expect(subject.refOfSource(source("Report"))).toBeNull()
    })
})

describe("stateOfSource", () => {
    it("is a draft when tagged nivo:draft or draft", async () => {
        const subject = await subjectOf()
        expect(subject.stateOfSource(source("a", ["nivo:draft"]), null)).toBe("draft")
        expect(subject.stateOfSource(source("a", ["draft"]), null)).toBe("draft")
    })

    it("is a draft when the title or origin says so", async () => {
        const subject = await subjectOf()
        expect(subject.stateOfSource(source("D\u1ef1 th\u1ea3o \u0111i\u1ec1u l\u1ec7"), null)).toBe("draft")
        expect(subject.stateOfSource(source("a", [], "Ch\u1edd k\u00fd"), null)).toBe("draft")
    })

    it("is a template when tagged or sourced as one", async () => {
        const subject = await subjectOf()
        expect(subject.stateOfSource(source("a", ["template"]), null)).toBe("template")
        expect(subject.stateOfSource(source("a", [], "_M\u1eabu c\u0169"), null)).toBe("template")
    })

    it("is a template when its title equals the template dossier name", async () => {
        const subject = await subjectOf()
        expect(subject.stateOfSource(source("58. Mau quyet dinh"), "Mau quyet dinh")).toBe("template")
        expect(subject.stateOfSource(source("58. Other"), "Mau quyet dinh")).toBe("actual")
    })

    it("is actual otherwise, with no origin at all", async () => {
        const subject = await subjectOf()
        expect(subject.stateOfSource(source("Charter"), null)).toBe("actual")
    })
})

describe("dates", () => {
    it("builds only real dates", async () => {
        const subject = await subjectOf()
        expect(subject.isoDate(2026, 1, 9)).toBe("2026-01-09")
        expect(subject.isoDate(2026, 2, 30)).toBeNull()
    })

    it("reads year-first and day-first dates and the earlier of two", async () => {
        const subject = await subjectOf()
        expect(subject.dateIn("2026.01.09_Charter")).toBe("2026-01-09")
        expect(subject.dateIn("06.01.2026 Minutes")).toBe("2026-01-06")
        expect(subject.dateIn("see 10/02/2025 and 2026-03-04")).toBe("2025-02-10")
        expect(subject.dateIn("2026-03-04 then 10/02/2025")).toBe("2026-03-04")
        expect(subject.dateIn("no date")).toBeNull()
        expect(subject.dateIn("31.02.2026")).toBeNull()
    })

    it("takes the earliest fact date, else the title date", async () => {
        const subject = await subjectOf()
        expect(subject.dateOfSource("x 01.02.2026", ["2026-05-01", "2026-03-01"])).toBe("2026-03-01")
        expect(subject.dateOfSource("x 01.02.2026", [])).toBe("2026-02-01")
    })

    it("adds days", async () => {
        const subject = await subjectOf()
        expect(subject.addDays("2026-12-31", 1)).toBe("2027-01-01")
        expect(subject.addDays("2026-03-01", -1)).toBe("2026-02-28")
    })
})
