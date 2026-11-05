import { Test } from "@nestjs/testing"
import type { PackageInput } from "../agent-templates.contracts"
import { packageRequestOf } from "./package-input.policy"

const SUBJECT = Symbol("package-input.policy")

const WORKSPACE = "11111111-1111-4111-8111-111111111111"

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { packageRequestOf } }],
    }).compile()
    return moduleRef.get<{ packageRequestOf: typeof packageRequestOf }>(SUBJECT)
}

const inputOf = (over: Partial<PackageInput> = {}): PackageInput => ({
    agentId: "22222222-2222-4222-8222-222222222222",
    graphVersionId: "33333333-3333-4333-8333-333333333333",
    key: "spa-booking-by-linh",
    name: { vi: "Dat lich spa", en: "Spa booking" },
    summary: { vi: "Quy trinh cua Linh", en: "Linh process" },
    category: "operations",
    parameters: [],
    bindings: [],
    starterDocumentIds: [],
    soul: "Than thien.",
    changelog: "First version",
    breaking: false,
    ...over,
})

describe("package-input.policy", () => {
    it("builds the request with the card, an empty list of points and plug-ins, and a neutral persona", async () => {
        const subject = await build()

        const request = subject.packageRequestOf(WORKSPACE, inputOf())

        expect(request).toEqual({
            workspaceId: WORKSPACE,
            agentId: "22222222-2222-4222-8222-222222222222",
            graphVersionId: "33333333-3333-4333-8333-333333333333",
            key: "spa-booking-by-linh",
            listing: {
                name: { vi: "Dat lich spa", en: "Spa booking" },
                summary: { vi: "Quy trinh cua Linh", en: "Linh process" },
                points: [],
                category: "operations",
            },
            parameters: [],
            bindings: [],
            starterDocumentIds: [],
            persona: { soul: "Than thien.", likeness: null },
            requiresPlugins: [],
            changelog: "First version",
            breaking: false,
        })
    })

    it("reads the default of a setting as a number, yes or no, or the text, by its kind", async () => {
        const subject = await build()
        const label = { vi: "Nhan", en: "Label" }

        const request = subject.packageRequestOf(
            WORKSPACE,
            inputOf({
                parameters: [
                    { key: "limit", kind: "number", label, min: 1, max: 9, required: true, defaultValue: "5" },
                    { key: "auto", kind: "toggle", label, required: false, defaultValue: "true" },
                    { key: "off", kind: "toggle", label, required: false, defaultValue: "false" },
                    { key: "shop", kind: "text", label, hint: label, required: false, defaultValue: "Spa" },
                    { key: "note", kind: "textarea", label, required: false, defaultValue: "Hello" },
                ],
            }),
        )

        expect(request.parameters.map((parameter) => parameter.default)).toEqual([5, true, false, "Spa", "Hello"])
        expect(request.parameters[0]).toMatchObject({ hint: null, min: 1, max: 9 })
        expect(request.parameters[1]).toMatchObject({ hint: null, min: null, max: null })
        expect(request.parameters[3]).toMatchObject({ hint: { vi: "Nhan", en: "Label" } })
    })

    it("keeps the term of a value binding, starts at the first term, and drops it for a wait", async () => {
        const subject = await build()

        const request = subject.packageRequestOf(
            WORKSPACE,
            inputOf({
                bindings: [
                    { parameter: "a", target: "branch_value", nodeKey: "n", branchKey: "b", termIndex: 2 },
                    { parameter: "b", target: "branch_value", nodeKey: "n", branchKey: "b" },
                    { parameter: "c", target: "branch_timeout", nodeKey: "n", branchKey: "b", termIndex: 3 },
                ],
            }),
        )

        expect(request.bindings).toEqual([
            { parameter: "a", target: "branch_value", nodeKey: "n", branchKey: "b", termIndex: 2 },
            { parameter: "b", target: "branch_value", nodeKey: "n", branchKey: "b", termIndex: 0 },
            { parameter: "c", target: "branch_timeout", nodeKey: "n", branchKey: "b" },
        ])
    })

    it("carries the real person the persona is modelled on", async () => {
        const subject = await build()
        const likeness = { personName: "Linh", allowedUses: ["name" as const], disclosure: "Based on Linh." }

        const request = subject.packageRequestOf(WORKSPACE, inputOf({ likeness }))

        expect(request.persona).toEqual({ soul: "Than thien.", likeness })
    })
})

describe("the time and choice settings", () => {
    it("reads a time and a choice as text and keeps the options of the choice", async () => {
        const subject = await build()
        const label = { vi: "Nhan", en: "Label" }
        const options = [
            { value: "friendly", label },
            { value: "formal", label },
        ]

        const request = subject.packageRequestOf(
            WORKSPACE,
            inputOf({
                parameters: [
                    { key: "opens", kind: "time", label, required: true, defaultValue: "09:00" },
                    { key: "tone", kind: "choice", label, required: true, defaultValue: "friendly", options },
                ],
            }),
        )

        expect(request.parameters.map((parameter) => parameter.default)).toEqual(["09:00", "friendly"])
        expect(request.parameters[0]).not.toHaveProperty("options")
        expect(request.parameters[1]?.options).toEqual(options)
    })
})
