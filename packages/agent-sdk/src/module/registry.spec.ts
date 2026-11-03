import { moduleListProblems, templatesOf } from "./registry"
import type { ModuleServer, ModuleTemplate } from "./module.types"

const TEXT = { vi: "v", en: "e" }
const LIST = { vi: ["v"], en: ["e"] }

const templateOf = (key: string, order: number, action: string): ModuleTemplate => ({
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
    authorityActions: [
        {
            action,
            label: TEXT,
            mode: "ask",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: null,
            note: "",
            next: [],
        },
    ],
    accepts: [{ command: action, action, subjectType: "lead", requiredFields: [], description: TEXT }],
})

const serverOf = (key: string, order: number, action: string): ModuleServer => ({
    key,
    template: templateOf(key, order, action),
})

describe("moduleListProblems", () => {
    it("accepts modules with unique keys and actions", () => {
        expect(moduleListProblems([serverOf("a", 1, "x"), serverOf("b", 2, "y")])).toEqual([])
    })

    it("refuses a duplicate key, a key unlike its template's and an action two modules share", () => {
        const mismatched: ModuleServer = { key: "c", template: templateOf("d", 3, "z") }
        expect(moduleListProblems([serverOf("a", 1, "x"), serverOf("a", 2, "x"), mismatched])).toEqual([
            { code: "MODULE_KEY_DUPLICATE", key: "a" },
            { code: "MODULE_ACTION_DUPLICATE", key: "x" },
            { code: "MODULE_KEY_MISMATCH", key: "c" },
        ])
    })

    it("refuses a command no action of its module governs", () => {
        const template = templateOf("a", 1, "x")
        const server: ModuleServer = {
            key: "a",
            template: {
                ...template,
                accepts: [
                    { command: "run", action: "missing", subjectType: "lead", requiredFields: [], description: TEXT },
                ],
            },
        }
        expect(moduleListProblems([server])).toEqual([{ code: "MODULE_COMMAND_UNKNOWN_ACTION", key: "a.run" }])
    })
})

describe("templatesOf", () => {
    it("lists the templates in catalogue order", () => {
        expect(templatesOf([serverOf("b", 2, "y"), serverOf("a", 1, "x")]).map((template) => template.key)).toEqual([
            "a",
            "b",
        ])
    })

    it("throws on the first problem", () => {
        expect(() => templatesOf([serverOf("a", 1, "x"), serverOf("a", 2, "y")])).toThrow("MODULE_KEY_DUPLICATE: a")
    })
})
