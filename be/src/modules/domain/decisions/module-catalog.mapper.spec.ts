import { builder } from "@starci/jest-preset"
import { toActionEntry, toModuleEntry } from "./module-catalog.mapper"
import type { ActionRow, ModuleRow } from "./persistence/module-catalog.rows"

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
    next: ["send_follow_up"],
})

describe("toModuleEntry", () => {
    it("reads the name and the accepted commands out of the definition", () => {
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

        expect(toModuleEntry(row)).toEqual({
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

    it("answers blanks for a definition that is not an object", () => {
        expect(toModuleEntry(moduleRowOf({ definition: [] }))).toEqual({
            key: "sales",
            audience: "internal",
            multiInstance: false,
            name: { vi: "", en: "" },
            accepts: [],
        })
    })

    it("answers blanks when the name and the commands have the wrong shape", () => {
        const row = moduleRowOf({ audience: "customer", definition: { name: "Sales", accepts: "none" } })

        expect(toModuleEntry(row)).toEqual({
            key: "sales",
            audience: "customer",
            multiInstance: false,
            name: { vi: "", en: "" },
            accepts: [],
        })
    })
})

describe("toActionEntry", () => {
    it("maps the row", () => {
        expect(toActionEntry(actionRowOf({ max_mode: "ask" }))).toEqual({
            action: "classify_lead",
            moduleKey: "sales",
            maxMode: "ask",
            next: ["send_follow_up"],
            label: { vi: "Phan loai", en: "Classify lead" },
        })
    })

    it("answers a blank label when the stored one is not an object", () => {
        expect(toActionEntry(actionRowOf({ label: "Classify" })).label).toEqual({ vi: "", en: "" })
    })

    it("keeps non-text label parts blank", () => {
        expect(toActionEntry(actionRowOf({ label: { vi: 1, en: "Classify" } })).label).toEqual({
            vi: "",
            en: "Classify",
        })
    })
})
