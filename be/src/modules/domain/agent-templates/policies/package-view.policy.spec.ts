import { Test } from "@nestjs/testing"
import { PARAMETERS, draftOf, leakyGraph, packageOf } from "@tests/fixtures/builders/agent-template.builder"
import type { PackageReport } from "../agent-templates.contracts"
import { parameterViewOf, previewViewOf } from "./package-view.policy"

const SUBJECT = Symbol("package-view.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { parameterViewOf, previewViewOf } }],
    }).compile()
    return moduleRef.get<{ parameterViewOf: typeof parameterViewOf; previewViewOf: typeof previewViewOf }>(SUBJECT)
}

const REPORT: PackageReport = { nodes: 3, branches: 4, brainRefs: 1, privateSources: 0, people: 2 }

describe("package-view.policy", () => {
    it("shows the default of a setting as text", async () => {
        const subject = await build()

        const views = PARAMETERS.map((parameter) => subject.parameterViewOf(parameter))

        expect(views[0]).toMatchObject({ key: "autoLimit", kind: "number", defaultValue: "5000000", hint: null })
        expect(views.map((view) => typeof view.defaultValue)).toEqual(PARAMETERS.map(() => "string"))
    })

    it("shows a refused preview with its problems and the term of each suggestion", async () => {
        const subject = await build()

        const view = subject.previewViewOf({
            package: null,
            report: REPORT,
            problems: ["graph: a secret"],
            suggestions: [
                { parameter: "a", target: "branch_value", nodeKey: "n", branchKey: "b", termIndex: 1 },
                { parameter: "b", target: "branch_timeout", nodeKey: "n", branchKey: "b" },
            ],
        })

        expect(view).toEqual({
            package: null,
            report: REPORT,
            problems: ["graph: a secret"],
            suggestions: [
                { parameter: "a", target: "branch_value", nodeKey: "n", branchKey: "b", termIndex: 1 },
                { parameter: "b", target: "branch_timeout", nodeKey: "n", branchKey: "b", termIndex: null },
            ],
        })
    })

    it("shows an accepted package with the count of its starter documents and no person for a neutral persona", async () => {
        const subject = await build()
        const stored = packageOf()

        const view = subject.previewViewOf({ package: stored, report: REPORT, problems: [], suggestions: [] })

        expect(view.package).toMatchObject({
            key: stored.key,
            version: stored.version,
            hash: stored.hash,
            baseModule: stored.baseModule,
            starterKnowledge: stored.starterKnowledge.length,
            personName: null,
        })
        expect(view.package?.parameters).toEqual(
            stored.parameters.map((parameter) => subject.parameterViewOf(parameter)),
        )
    })

    it("names the person a persona is modelled on", async () => {
        const subject = await build()
        const likeness = { personName: "Linh", allowedUses: ["name" as const], disclosure: "Based on Linh." }
        const stored = packageOf(leakyGraph(), draftOf({ persona: { soul: "Hi.", likeness } }))

        const view = subject.previewViewOf({ package: stored, report: REPORT, problems: [], suggestions: [] })

        expect(view.package?.personName).toBe("Linh")
    })
})
