import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { toActionEntry, toModuleEntry } from "./module-catalog.mapper"
import type { ActionRow, ModuleRow } from "./persistence/module-catalog.rows"

const SUBJECT = Symbol("module-catalog.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toModuleEntry, toActionEntry } }],
    }).compile()
    return moduleRef.get<typeof import("./module-catalog.mapper")>(SUBJECT)
}

const moduleRowOf = builder<ModuleRow>({
    key: "sales",
    audience: "internal",
    multi_instance: false,
    definition: {},
})

const actionRowOf = builder<ActionRow>({
    action: "classify_lead",
    module_key: "sales",
    max_mode: null,
    label: { vi: "Phan loai", en: "Classify lead" },
    definition: { authorityActions: [{ action: "classify_lead", next: ["send_follow_up"] }] },
})

describe("toModuleEntry", () => {
    it("reads the name and the accepted commands out of the definition", async () => {
        const subject = await buildSubject()

        const row = moduleRowOf({
            multi_instance: true,
            definition: {
                name: { vi: "Ban hang", en: "Sales" },
                accepts: [
                    {
                        command: "classify_lead",
                        action: "classify_lead",
                        subject_type: "lead",
                        required_fields: ["lead_id", 7],
                        description: { vi: "phan loai", en: "classify the lead" },
                    },
                    "not a command",
                    { command: "bare" },
                ],
            },
        })

        expect(subject.toModuleEntry(row)).toEqual({
            key: "sales",
            audience: "internal",
            multiInstance: true,
            name: { vi: "Ban hang", en: "Sales" },
            accepts: [
                {
                    command: "classify_lead",
                    action: "classify_lead",
                    subjectType: "lead",
                    requiredFields: ["lead_id"],
                    description: { vi: "phan loai", en: "classify the lead" },
                },
                {
                    command: "bare",
                    action: "",
                    subjectType: "",
                    requiredFields: [],
                    description: { vi: "", en: "" },
                },
            ],
        })
    })

    it("answers blanks for a definition that is not an object", async () => {
        const subject = await buildSubject()

        expect(subject.toModuleEntry(moduleRowOf({ definition: [] }))).toEqual({
            key: "sales",
            audience: "internal",
            multiInstance: false,
            name: { vi: "", en: "" },
            accepts: [],
        })
    })

    it("answers blanks when the name and the commands have the wrong shape", async () => {
        const subject = await buildSubject()

        const row = moduleRowOf({ audience: "customer", definition: { name: "Sales", accepts: "none" } })

        expect(subject.toModuleEntry(row)).toEqual({
            key: "sales",
            audience: "customer",
            multiInstance: false,
            name: { vi: "", en: "" },
            accepts: [],
        })
    })
})

describe("toActionEntry", () => {
    it("maps the row", async () => {
        const subject = await buildSubject()

        expect(subject.toActionEntry(actionRowOf({ max_mode: "ask" }))).toEqual({
            action: "classify_lead",
            moduleKey: "sales",
            maxMode: "ask",
            next: ["send_follow_up"],
            label: { vi: "Phan loai", en: "Classify lead" },
        })
    })

    it("answers a blank label when the stored one is not an object", async () => {
        const subject = await buildSubject()

        expect(subject.toActionEntry(actionRowOf({ label: "Classify" })).label).toEqual({ vi: "", en: "" })
    })

    it("keeps non-text label parts blank", async () => {
        const subject = await buildSubject()

        expect(subject.toActionEntry(actionRowOf({ label: { vi: 1, en: "Classify" } })).label).toEqual({
            vi: "",
            en: "Classify",
        })
    })

    it("reads the follow-ups from the snake_case key, only for the action asked, in listed order", async () => {
        const subject = await buildSubject()
        const definition = {
            authority_actions: [
                { action: "other", next: ["x"] },
                { action: "classify_lead", next: ["send_follow_up", "close_lead"] },
                { action: "classify_lead" },
            ],
        }

        expect(subject.toActionEntry(actionRowOf({ definition })).next).toEqual(["send_follow_up", "close_lead"])
    })

    it("reads a follow-up that is not text as its JSON and skips a null one", async () => {
        const subject = await buildSubject()
        const definition = { authorityActions: [{ action: "classify_lead", next: ["a", 2, null, { b: 1 }] }] }

        expect(subject.toActionEntry(actionRowOf({ definition })).next).toEqual(["a", "2", '{"b":1}'])
    })

    it("has no follow-ups for an action whose next is not a list", async () => {
        const subject = await buildSubject()
        const definition = { authorityActions: [{ action: "classify_lead", next: "send_follow_up" }] }

        expect(subject.toActionEntry(actionRowOf({ definition })).next).toEqual([])
    })

    it("has no follow-ups when the definition lists none", async () => {
        const subject = await buildSubject()

        expect(subject.toActionEntry(actionRowOf({ definition: {} })).next).toEqual([])
        expect(subject.toActionEntry(actionRowOf({ definition: { authorityActions: "none" } })).next).toEqual([])
        expect(subject.toActionEntry(actionRowOf({ definition: null })).next).toEqual([])
    })
})
