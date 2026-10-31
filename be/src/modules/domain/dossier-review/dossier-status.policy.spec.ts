import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { statusOf } from "./dossier-status.policy"
import type { StatusFacts } from "./dossier-status.policy"

const SUBJECT = Symbol("dossier-status.policy")
type Subject = { statusOf: typeof statusOf }
const subjectOf = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { statusOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const factsOf = builder<StatusFacts>({
    requirement: "required",
    checklistStatus: "partial",
    actual: 2,
    drafts: 0,
    active: [],
})

describe("statusOf", () => {
    it("is template for a template requirement", async () => {
        const subject = await subjectOf()
        expect(subject.statusOf(factsOf({ requirement: "template", actual: 0 }))).toBe("template")
    })

    it("is template for a checklist template without a pack entry", async () => {
        const subject = await subjectOf()
        expect(subject.statusOf(factsOf({ requirement: null, checklistStatus: "template" }))).toBe("template")
    })

    it("follows the checklist for an optional dossier with no document", async () => {
        const subject = await subjectOf()
        expect(subject.statusOf(factsOf({ requirement: "optional", checklistStatus: "present", actual: 0 }))).toBe(
            "present",
        )
    })

    it("is missing for any other dossier with no document", async () => {
        const subject = await subjectOf()
        expect(subject.statusOf(factsOf({ actual: 0 }))).toBe("missing")
        expect(subject.statusOf(factsOf({ requirement: null, actual: 0 }))).toBe("missing")
    })

    it("is drafted when only drafts are held", async () => {
        const subject = await subjectOf()
        expect(subject.statusOf(factsOf({ actual: 0, drafts: 1 }))).toBe("drafted")
    })

    it("is partial for an active critical, high or medium finding that is not unsigned", async () => {
        const subject = await subjectOf()
        expect(subject.statusOf(factsOf({ active: [{ kind: "missing", severity: "medium" }] }))).toBe("partial")
        expect(subject.statusOf(factsOf({ active: [{ kind: "outdated", severity: "critical" }] }))).toBe("partial")
    })

    it("is drafted for an unsigned finding alone", async () => {
        const subject = await subjectOf()
        expect(subject.statusOf(factsOf({ active: [{ kind: "unsigned", severity: "high" }] }))).toBe("drafted")
    })

    it("is present when only low findings remain or none", async () => {
        const subject = await subjectOf()
        expect(subject.statusOf(factsOf({ active: [{ kind: "missing", severity: "low" }] }))).toBe("present")
        expect(subject.statusOf(factsOf({}))).toBe("present")
    })
})
