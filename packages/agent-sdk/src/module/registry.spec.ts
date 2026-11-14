import { moduleListProblems, templatesOf } from "./registry"
import { thrownFailureOf } from "../tests/thrown-failure"
import type { ModuleServer, ModuleTemplate } from "./module.types"

const TEXT = { vi: "v", en: "e" }
const LIST = { vi: ["v"], en: ["e"] }

const templateOf = (key: string, order: number): ModuleTemplate => ({
    key,
    order,
    name: TEXT,
    shortName: TEXT,
    description: TEXT,
    points: LIST,
    purpose: "p",
    icon: "i",
    glyph: "g",
    mascot: "m",
    category: "c",
    status: "early",
    audience: "customer",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: key,
    workbench: key,
    settingsExtras: null,
    requires: { capabilities: [], connections: [] },
    connectionProviders: [],
    defaultOperatingMode: "assist",
    multiInstance: false,
    agent: { label: TEXT, handle: key, summary: TEXT, capabilities: LIST, role: TEXT, instructions: TEXT },
    gates: [],
})

const serverOf = (key: string, order: number): ModuleServer => ({
    key,
    template: templateOf(key, order),
})

describe("moduleListProblems", () => {
    it("accepts modules with unique keys", () => {
        expect(moduleListProblems([serverOf("a", 1), serverOf("b", 2)])).toEqual([])
    })

    it("refuses a duplicate key and a key unlike its template's", () => {
        const mismatched: ModuleServer = { key: "c", template: templateOf("d", 3) }
        expect(moduleListProblems([serverOf("a", 1), serverOf("a", 2), mismatched])).toEqual([
            { code: "MODULE_KEY_DUPLICATE", key: "a" },
            { code: "MODULE_KEY_MISMATCH", key: "c" },
        ])
    })
})

describe("templatesOf", () => {
    it("lists the templates in catalogue order", () => {
        expect(templatesOf([serverOf("b", 2), serverOf("a", 1)]).map((template) => template.key)).toEqual([
            "a",
            "b",
        ])
    })

    it("throws on the first problem", () => {
        expect(thrownFailureOf(() => templatesOf([serverOf("a", 1), serverOf("a", 2)]))).toEqual({ code: "MODULE_KEY_DUPLICATE", at: "a" })
    })
})
