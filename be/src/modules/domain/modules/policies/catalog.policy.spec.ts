import { MODULE_CATEGORIES } from "../categories.contracts"
import { MODULE_CATALOG } from "../modules.catalog.contracts"
import type {
    AcceptedCommand,
    AuthorityActionDefinition,
    ModuleCategory,
    ModuleDefinition,
    ModuleGate,
} from "../modules.contracts"
import { checkCatalog } from "./catalog.policy"

const text = { vi: "v", en: "e" }
const blank = { vi: "", en: "" }
const list = { vi: ["v"], en: ["e"] }
const CATEGORIES: ReadonlyArray<ModuleCategory> = [{ key: "ops", label: text }]
const GATE: ModuleGate = { key: "g1", label_vi: "v", label_en: "e", hint_vi: "v", hint_en: "e" }
const ACTION: AuthorityActionDefinition = {
    action: "do_thing",
    label: text,
    mode: "ask",
    limitVnd: null,
    requiredFields: [],
    amountLimit: false,
    maxMode: null,
    note: "",
    next: [],
}
const COMMAND: AcceptedCommand = {
    command: "do_it",
    action: "do_thing",
    subjectType: "thing",
    requiredFields: [],
    description: text,
}
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
    agent: { name: "Demo Agent", handle: "demo", summary: text, capabilities: list, role: text, instructions: text },
    gates: [GATE],
    authorityActions: [ACTION],
    accepts: [COMMAND],
}

const check = (module: ModuleDefinition): string => checkCatalog([module], CATEGORIES).join("\n")

describe("checkCatalog", () => {
    it("finds no problem in a sound module", () => {
        expect(checkCatalog([GOOD], CATEGORIES)).toEqual([])
    })

    it("finds no problem in a module whose gates write a fact and a rule of its own action", () => {
        const gates: ReadonlyArray<ModuleGate> = [
            {
                ...GATE,
                writes: [
                    { kind: "fact", subjectType: "business", attributeLabel: "x", scope: "public" },
                    { kind: "rule", action: "do_thing", field: "mode" },
                ],
            },
        ]

        expect(checkCatalog([{ ...GOOD, gates }], CATEGORIES)).toEqual([])
    })

    it("finds no problem in the shipped catalogue", () => {
        expect(checkCatalog(MODULE_CATALOG, MODULE_CATEGORIES)).toEqual([])
    })

    it.each<[string, ModuleDefinition, string]>([
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
        ["an agent without a name", { ...GOOD, agent: { ...GOOD.agent, name: "" } }, "agent name and handle"],
        ["an agent without a handle", { ...GOOD, agent: { ...GOOD.agent, handle: "" } }, "agent name and handle"],
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
        [
            "a gate rule write for an action the module does not own",
            { ...GOOD, gates: [{ ...GATE, writes: [{ kind: "rule", action: "nope", field: "mode" }] }] },
            "a gate rule write names an action",
        ],
        ["no authority actions", { ...GOOD, authorityActions: [] }, "authorityActions must not be empty"],
        [
            "a badly named action",
            { ...GOOD, authorityActions: [{ ...ACTION, action: "Bad Action" }] },
            "bad action Bad Action",
        ],
        [
            "an action without a label",
            { ...GOOD, authorityActions: [{ ...ACTION, label: blank }] },
            "bad action do_thing",
        ],
        [
            "an action accepted by two commands",
            { ...GOOD, accepts: [COMMAND, { ...COMMAND, command: "other_command" }] },
            "action do_thing is accepted by two commands",
        ],
        ["an action without a command", { ...GOOD, accepts: [] }, "action do_thing has no accepted command"],
        [
            "a command for an action the module does not own",
            { ...GOOD, accepts: [COMMAND, { ...COMMAND, command: "stray", action: "nope" }] },
            "command stray maps to an action",
        ],
        [
            "a command with a bad subject",
            { ...GOOD, accepts: [{ ...COMMAND, subjectType: "Bad" }] },
            "needs a lower_snake subject",
        ],
        [
            "a command without a description",
            { ...GOOD, accepts: [{ ...COMMAND, description: blank }] },
            "needs a lower_snake subject",
        ],
        [
            "a duplicate command",
            { ...GOOD, accepts: [COMMAND, { ...COMMAND, action: "nope" }] },
            "duplicate command do_it",
        ],
        [
            "an action that chains to an unknown action",
            { ...GOOD, authorityActions: [{ ...ACTION, next: ["nowhere"] }] },
            "chains to unknown action nowhere",
        ],
    ])("finds %s", (_name, module, problem) => {
        expect(check(module)).toContain(problem)
    })

    it("finds a module declared twice", () => {
        expect(checkCatalog([GOOD, GOOD], CATEGORIES).join("\n")).toContain("duplicate module demo")
    })

    it("finds an action declared by two modules", () => {
        expect(checkCatalog([GOOD, { ...GOOD, key: "other" }], CATEGORIES).join("\n")).toContain(
            "action do_thing is declared by two modules",
        )
    })
})
