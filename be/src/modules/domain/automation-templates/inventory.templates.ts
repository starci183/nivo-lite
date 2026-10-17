import type { TemplateDefinition } from "./automation-templates.contracts"
import { translate } from "./policies/catalog-text.policy"

/** The inventory templates the engine runs itself, in file-name order. */
export const INVENTORY_TEMPLATES: ReadonlyArray<TemplateDefinition> = [
    {
        position: 16,
        key: "inventory_low_stock",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: "inventory",
        icon: "cart",
        name: translate("automationTemplates.inventory_low_stock.name"),
        description: translate("automationTemplates.inventory_low_stock.description"),
        trigger: {
            kind: "schedule",
            event: "schedule.daily",
            line: translate("automationTemplates.inventory_low_stock.line"),
        },
        requires: {
            modules: ["inventory"],
            channels: [],
            connections: [],
            capabilities: [],
        },
        settings: [
            {
                key: "time",
                kind: "time",
                label: translate("automationTemplates.inventory_low_stock.settings.time.label"),
            },
        ],
        contentMode: "none",
        guardrails: [
            translate("automationTemplates.inventory_low_stock.guardrails.0"),
            translate("automationTemplates.inventory_low_stock.guardrails.1"),
        ],
        variables: [],
        defaultBody: null,
        authority: {
            action: null,
        },
        defaults: {
            time: "07:30",
        },
    },
    {
        position: 18,
        key: "inventory_supplier_overdue",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: "inventory",
        icon: "truck",
        name: translate("automationTemplates.inventory_supplier_overdue.name"),
        description: translate("automationTemplates.inventory_supplier_overdue.description"),
        trigger: {
            kind: "schedule",
            event: "schedule.daily",
            line: translate("automationTemplates.inventory_supplier_overdue.line"),
        },
        requires: {
            modules: ["inventory"],
            channels: [],
            connections: [],
            capabilities: [],
        },
        settings: [
            {
                key: "time",
                kind: "time",
                label: translate("automationTemplates.inventory_supplier_overdue.settings.time.label"),
            },
            {
                key: "graceDays",
                kind: "number",
                min: 0,
                max: 30,
                suffix: translate("automationTemplates.inventory_supplier_overdue.settings.graceDays.suffix"),
                label: translate("automationTemplates.inventory_supplier_overdue.settings.graceDays.label"),
            },
        ],
        contentMode: "none",
        guardrails: [translate("automationTemplates.inventory_supplier_overdue.guardrails.0")],
        variables: [],
        defaultBody: null,
        authority: {
            action: null,
        },
        defaults: {
            time: "09:00",
            graceDays: 1,
        },
    },
    {
        position: 17,
        key: "inventory_weekly_report",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: "inventory",
        icon: "report",
        name: translate("automationTemplates.inventory_weekly_report.name"),
        description: translate("automationTemplates.inventory_weekly_report.description"),
        trigger: {
            kind: "schedule",
            event: "schedule.daily",
            line: translate("automationTemplates.inventory_weekly_report.line"),
        },
        requires: {
            modules: ["inventory"],
            channels: [],
            connections: [],
            capabilities: [],
        },
        settings: [
            {
                key: "time",
                kind: "time",
                label: translate("automationTemplates.inventory_weekly_report.settings.time.label"),
            },
            {
                key: "email",
                kind: "email",
                label: translate("automationTemplates.inventory_weekly_report.settings.email.label"),
                hint: translate("automationTemplates.inventory_weekly_report.settings.email.hint"),
            },
        ],
        contentMode: "none",
        guardrails: [translate("automationTemplates.inventory_weekly_report.guardrails.0")],
        variables: [],
        defaultBody: null,
        authority: {
            action: null,
        },
        defaults: {
            time: "17:00",
            email: "",
        },
    },
]
