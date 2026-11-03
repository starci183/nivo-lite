import { BLOCKS } from "../spec/spec.fixture"
import { moduleFixture } from "./module-document.fixture"
import { moduleDocumentSchema } from "./module-document.schema"
import { MODULE_CHANGELOG_MAX, moduleProblems } from "./module-problems"
import type { ModuleDocument } from "./module-document.types"

const codesOf = (doc: ModuleDocument): ReadonlyArray<string> =>
    moduleProblems(doc, BLOCKS).map((problem) => problem.code)

describe("moduleDocumentSchema", () => {
    it("parses a whole document and refuses an unknown member or another schema id", () => {
        const doc = moduleFixture()
        expect(moduleDocumentSchema.parse(doc)).toEqual(doc)
        expect(moduleDocumentSchema.safeParse({ ...doc, extra: 1 }).success).toBe(false)
        expect(moduleDocumentSchema.safeParse({ ...doc, schema: "nivo/module@2" }).success).toBe(false)
        expect(
            moduleDocumentSchema.safeParse({
                ...doc,
                template: { ...doc.template, rights: [{ kind: "x", access: "read", scope: "turn", fields: [] }] },
            }).success,
        ).toBe(false)
    })
})

describe("moduleProblems", () => {
    it("accepts a sound document", () => {
        expect(codesOf(moduleFixture())).toEqual([])
    })

    it("refuses a malformed key, a bad version and a long changelog", () => {
        const doc = moduleFixture()
        expect(codesOf({ ...doc, key: "Sales!" })).toContain("MODULE_KEY_MALFORMED")
        expect(codesOf({ ...doc, version: 0 })).toContain("MODULE_VERSION_INVALID")
        expect(codesOf({ ...doc, version: 1.5 })).toContain("MODULE_VERSION_INVALID")
        expect(codesOf({ ...doc, changelog: "x".repeat(MODULE_CHANGELOG_MAX + 1) })).toContain(
            "MODULE_CHANGELOG_TOO_LONG",
        )
    })

    it("names a missing language wherever a bilingual text sits", () => {
        const doc = moduleFixture()
        const blank = {
            ...doc,
            manifest: { ...doc.manifest, name: { vi: "", en: "e" }, points: { vi: ["v"], en: ["e"] } },
        }
        expect(moduleProblems(blank, BLOCKS)).toEqual([
            { code: "MODULE_TEXT_LANGUAGE_MISSING", at: "doc.manifest.name" },
        ])
        const inList = { ...doc, manifest: { ...doc.manifest, points: { vi: ["v"], en: [] } } }
        expect(codesOf(inList)).toEqual([])
        const gate = {
            ...doc,
            template: {
                ...doc.template,
                gates: [{ key: "g", label: { vi: "v", en: " " }, hint: { vi: "v", en: "e" } }],
            },
        }
        expect(moduleProblems(gate, BLOCKS)[0]?.at).toBe("doc.template.gates[0].label")
    })

    it("refuses a duplicate action, and a command or intent naming an action the module does not govern", () => {
        const doc = moduleFixture()
        const [action] = doc.template.authorityActions
        if (action === undefined) throw new RangeError("fixture")
        const twice = { ...doc, template: { ...doc.template, authorityActions: [action, action] } }
        expect(codesOf(twice)).toEqual(["MODULE_ACTION_DUPLICATE"])
        const command = {
            ...doc,
            template: { ...doc.template, accepts: [{ ...doc.template.accepts[0]!, action: "gone" }] },
        }
        expect(moduleProblems(command, BLOCKS)).toEqual([{ code: "MODULE_COMMAND_UNKNOWN_ACTION", at: "sales.order" }])
        const intent = {
            ...doc,
            contracts: { ...doc.contracts, intents: [{ ...doc.contracts.intents[0]!, intent: "gone" }] },
        }
        expect(moduleProblems(intent, BLOCKS)).toEqual([{ code: "MODULE_INTENT_UNKNOWN_ACTION", at: "sales.gone" }])
    })

    it("refuses a missing main workbench, a foreign spec and a spec that fails the installed blocks", () => {
        const doc = moduleFixture()
        const main = doc.workbenches.main
        if (main === undefined) throw new RangeError("fixture")
        expect(codesOf({ ...doc, workbenches: {} })).toEqual(["MODULE_WORKBENCH_MAIN_MISSING"])
        expect(codesOf({ ...doc, workbenches: { main: { ...main, module: "chatbot" } } })).toEqual([
            "MODULE_WORKBENCH_FOREIGN",
        ])
        const broken = { ...main, views: [{ ...main.views[0]!, root: { id: "root", block: "test.nope" as const } }] }
        expect(moduleProblems({ ...doc, workbenches: { main: broken } }, BLOCKS)).toEqual([
            { code: "MODULE_SPEC_PROBLEM", at: "workbenches.main:main/root", detail: "SPEC_BLOCK_UNKNOWN" },
        ])
    })
})
