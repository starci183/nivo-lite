import { Test } from "@nestjs/testing"
import { MODULE_CATEGORIES } from "../categories.contracts"
import { MODULE_CATALOG } from "../modules.catalog.contracts"
import type { ModuleCategory, ModuleDefinition, ModuleGate } from "../modules.contracts"
import { checkCatalog as realCheckCatalog } from "./catalog.policy"

const SUBJECT = Symbol("catalog.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { checkCatalog: realCheckCatalog } }],
    }).compile()
    const subject = moduleRef.get<{ checkCatalog: typeof realCheckCatalog }>(SUBJECT)
    const checkCatalog = subject.checkCatalog
    const check = (module: ModuleDefinition): string => checkCatalog([module], CATEGORIES).join("\n")
    return { checkCatalog, check }
}

const text = { vi: "v", en: "e" }
const blank = { vi: "", en: "" }
const list = { vi: ["v"], en: ["e"] }
const CATEGORIES: ReadonlyArray<ModuleCategory> = [{ key: "ops", label: text }]
const GATE: ModuleGate = { key: "g1", label_vi: "v", label_en: "e", hint_vi: "v", hint_en: "e" }
const GOOD: ModuleDefinition = {
    key: "demo",
    order: 1,
    name: text,
    shortName: text,
    description: text,
    points: list,
    purpose: "Demo.",
    icon: "bolt",
    glyph: "M0 0",
    mascot: "/m.png",
    category: "ops",
    status: "stable",
    audience: "customer",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "demo",
    workbench: null,
    settingsExtras: null,
    requires: { capabilities: [], connections: [] },
    connectionProviders: [],
    defaultOperatingMode: "assist",
    multiInstance: false,
    agent: { label: text, handle: "demo", summary: text, capabilities: list, role: text, instructions: text },
    gates: [GATE],
}

const INVALID_MODULES: Array<[string, ModuleDefinition, string]> = [
    ["a key that is not lowercase ASCII", { ...GOOD, key: "Bad-Key" }, "key must be short lowercase ASCII"],
    ["a name missing its English text", { ...GOOD, name: { vi: "x", en: " " } }, "name needs"],
    ["a short name missing its Vietnamese text", { ...GOOD, shortName: { vi: "", en: "x" } }, "shortName needs"],
    ["a blank description", { ...GOOD, description: blank }, "description needs"],
    ["points without English items", { ...GOOD, points: { vi: ["x"], en: [] } }, "points need items"],
    ["points without Vietnamese items", { ...GOOD, points: { vi: [], en: ["x"] } }, "points need items"],
    ["a blank purpose", { ...GOOD, purpose: " " }, "purpose is required"],
    ["a blank icon", { ...GOOD, icon: "" }, "icon, glyph and mascot"],
    ["a blank glyph", { ...GOOD, glyph: "" }, "icon, glyph and mascot"],
    ["a blank mascot", { ...GOOD, mascot: "" }, "icon, glyph and mascot"],
    ["a blank knowledge folder", { ...GOOD, knowledgeFolder: "" }, "knowledgeFolder is required"],
    [
        "an agent without a label",
        { ...GOOD, agent: { ...GOOD.agent, label: { vi: "", en: "x" } } },
        "agent label and handle",
    ],
    ["an agent without a handle", { ...GOOD, agent: { ...GOOD.agent, handle: "" } }, "agent label and handle"],
    [
        "an agent without a summary",
        { ...GOOD, agent: { ...GOOD.agent, summary: { vi: "", en: "x" } } },
        "agent summary, role and capabilities",
    ],
    [
        "an agent without a role",
        { ...GOOD, agent: { ...GOOD.agent, role: { vi: "x", en: "" } } },
        "agent summary, role and capabilities",
    ],
    [
        "an agent without Vietnamese capabilities",
        { ...GOOD, agent: { ...GOOD.agent, capabilities: { vi: [], en: ["x"] } } },
        "agent summary, role and capabilities",
    ],
    [
        "an agent without English capabilities",
        { ...GOOD, agent: { ...GOOD.agent, capabilities: { vi: ["x"], en: [] } } },
        "agent summary, role and capabilities",
    ],
    [
        "several instances of a back-office agent",
        { ...GOOD, audience: "internal", multiInstance: true },
        "multiInstance is only for customer",
    ],
    ["an unknown category", { ...GOOD, category: "nowhere" }, "unknown category nowhere"],
    ["no gates", { ...GOOD, gates: [] }, "gates must not be empty"],
    ["a gate without a hint", { ...GOOD, gates: [{ ...GATE, hint_en: "" }] }, "every gate needs"],
    ["a duplicate gate", { ...GOOD, gates: [GATE, GATE] }, "duplicate gate g1"],
]

describe("checkCatalog", () => {
    it("finds no problem in a sound module", async () => {
        const { checkCatalog } = await buildSubject()

        expect(checkCatalog([GOOD], CATEGORIES)).toEqual([])
    })

    it("finds no problem in a module whose gates write a fact", async () => {
        const { checkCatalog } = await buildSubject()

        const gates: ReadonlyArray<ModuleGate> = [
            {
                ...GATE,
                writes: [
                    { kind: "fact", subjectType: "business", attributeLabel: "x", scope: "public" },
                ],
            },
        ]

        expect(checkCatalog([{ ...GOOD, gates }], CATEGORIES)).toEqual([])
    })

    it("lets a back-office agent that speaks on channels run several instances (one role, many agents)", async () => {
        const { checkCatalog } = await buildSubject()

        const module: ModuleDefinition = {
            ...GOOD,
            audience: "internal",
            multiInstance: true,
            connectionProviders: ["telegram"],
        }

        expect(checkCatalog([module], CATEGORIES)).toEqual([])
    })

    it("finds no problem in the shipped catalogue", async () => {
        const { checkCatalog } = await buildSubject()

        expect(checkCatalog(MODULE_CATALOG, MODULE_CATEGORIES)).toEqual([])
    })
})

describe("checkCatalog", () => {
    it.each<[string, ModuleDefinition, string]>(INVALID_MODULES)("finds %s", async (_name, module, problem) => {
        const { check } = await buildSubject()
        expect(check(module)).toContain(problem)
    })
})

describe("checkCatalog", () => {
    it("finds a module declared twice", async () => {
        const { checkCatalog } = await buildSubject()

        expect(checkCatalog([GOOD, GOOD], CATEGORIES).join("\n")).toContain("duplicate module demo")
    })
})
