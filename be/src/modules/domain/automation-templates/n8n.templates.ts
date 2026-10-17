import type { TemplateDefinition } from "./automation-templates.contracts"
import { translate } from "./policies/catalog-text.policy"

/** The templates a shared n8n workflow runs (executor `n8n`), in file-name order; the workflows themselves live with the n8n host. */
export const N8N_TEMPLATES: ReadonlyArray<TemplateDefinition> = [
    {
        position: 27,
        key: "email-daily-report",
        version: 1,
        pack: "email",
        executor: "n8n",
        moduleKey: null,
        icon: "report",
        name: translate("automationTemplates.email-daily-report.name"),
        description: translate("automationTemplates.email-daily-report.description"),
        trigger: {
            kind: "schedule",
            event: "schedule.daily",
            line: translate("automationTemplates.email-daily-report.line"),
        },
        requires: {
            modules: [],
            channels: [],
            connections: ["smtp"],
            capabilities: [],
        },
        settings: [
            {
                key: "time",
                kind: "time",
                label: translate("automationTemplates.email-daily-report.settings.time.label"),
            },
            {
                key: "subject",
                kind: "text",
                label: translate("automationTemplates.email-daily-report.settings.subject.label"),
            },
        ],
        contentMode: "fixed",
        guardrails: [translate("automationTemplates.email-daily-report.guardrails.0")],
        variables: ["ten_shop", "ngay", "tom_tat", "viec_cho"],
        defaultBody: translate("automationTemplates.email-daily-report.defaultBody"),
        authority: {
            action: null,
        },
        defaults: {
            time: "21:00",
            subject: "B\u00e1o c\u00e1o ng\u00e0y {ngay} c\u1ee7a {ten_shop}",
        },
        n8n: {
            webhook: "nivo/email-daily-report",
            data: ["GET /api/n8n/data/daily-summary"],
            audience: "owner",
        },
    },
    {
        position: 29,
        key: "email-debt-reminder",
        version: 1,
        pack: "email",
        executor: "n8n",
        moduleKey: "accounting",
        icon: "debt",
        name: translate("automationTemplates.email-debt-reminder.name"),
        description: translate("automationTemplates.email-debt-reminder.description"),
        trigger: {
            kind: "schedule",
            event: "schedule.daily",
            line: translate("automationTemplates.email-debt-reminder.line"),
        },
        requires: {
            modules: ["accounting"],
            channels: [],
            connections: ["smtp"],
            capabilities: ["has_due_dates"],
        },
        settings: [
            {
                key: "time",
                kind: "time",
                label: translate("automationTemplates.email-debt-reminder.settings.time.label"),
            },
            {
                key: "after_days",
                kind: "number",
                min: 0,
                max: 60,
                suffix: translate("automationTemplates.email-debt-reminder.settings.after_days.suffix"),
                label: translate("automationTemplates.email-debt-reminder.settings.after_days.label"),
            },
            {
                key: "repeat_days",
                kind: "number",
                min: 1,
                max: 90,
                suffix: translate("automationTemplates.email-debt-reminder.settings.repeat_days.suffix"),
                label: translate("automationTemplates.email-debt-reminder.settings.repeat_days.label"),
            },
            {
                key: "subject",
                kind: "text",
                label: translate("automationTemplates.email-debt-reminder.settings.subject.label"),
            },
        ],
        contentMode: "fixed",
        guardrails: [
            translate("automationTemplates.email-debt-reminder.guardrails.0"),
            translate("automationTemplates.email-debt-reminder.guardrails.1"),
        ],
        variables: ["ten_khach", "ten_shop", "so_tien", "ma_phieu", "han", "so_ngay_tre"],
        defaultBody: translate("automationTemplates.email-debt-reminder.defaultBody"),
        authority: {
            action: "send_email",
        },
        defaults: {
            time: "09:00",
            after_days: 3,
            repeat_days: 7,
            subject: "Nh\u1eafc nh\u1eb9 kho\u1ea3n {so_tien} (phi\u1ebfu {ma_phieu}) t\u1ea1i {ten_shop}",
        },
        n8n: {
            webhook: "nivo/email-debt-reminder",
            data: ["GET /api/n8n/data/overdue-invoices"],
            audience: "customer",
        },
    },
    {
        position: 30,
        key: "email-month-ledger",
        version: 1,
        pack: "email",
        executor: "n8n",
        moduleKey: "accounting",
        icon: "ledger",
        name: translate("automationTemplates.email-month-ledger.name"),
        description: translate("automationTemplates.email-month-ledger.description"),
        trigger: {
            kind: "schedule",
            event: "schedule.monthly",
            line: translate("automationTemplates.email-month-ledger.line"),
        },
        requires: {
            modules: ["accounting"],
            channels: [],
            connections: ["smtp"],
            capabilities: [],
        },
        settings: [
            {
                key: "accountant_email",
                kind: "email",
                required: true,
                label: translate("automationTemplates.email-month-ledger.settings.accountant_email.label"),
            },
            {
                key: "time",
                kind: "time",
                label: translate("automationTemplates.email-month-ledger.settings.time.label"),
            },
            {
                key: "subject",
                kind: "text",
                label: translate("automationTemplates.email-month-ledger.settings.subject.label"),
            },
        ],
        contentMode: "fixed",
        guardrails: [translate("automationTemplates.email-month-ledger.guardrails.0")],
        variables: ["ten_shop", "ky", "tom_tat"],
        defaultBody: translate("automationTemplates.email-month-ledger.defaultBody"),
        authority: {
            action: null,
        },
        defaults: {
            time: "07:00",
            subject: "S\u1ed5 c\u00e1i th\u00e1ng {ky} c\u1ee7a {ten_shop}",
        },
        n8n: {
            webhook: "nivo/email-month-ledger",
            data: ["GET /api/n8n/data/month-ledger"],
            audience: "owner",
        },
    },
    {
        position: 28,
        key: "email-payment-receipt",
        version: 1,
        pack: "email",
        executor: "n8n",
        moduleKey: "accounting",
        icon: "receipt",
        name: translate("automationTemplates.email-payment-receipt.name"),
        description: translate("automationTemplates.email-payment-receipt.description"),
        trigger: {
            kind: "event",
            event: "payment.received",
            line: translate("automationTemplates.email-payment-receipt.line"),
        },
        requires: {
            modules: ["accounting"],
            channels: [],
            connections: ["smtp"],
            capabilities: [],
        },
        settings: [
            {
                key: "subject",
                kind: "text",
                label: translate("automationTemplates.email-payment-receipt.settings.subject.label"),
            },
        ],
        contentMode: "fixed",
        guardrails: [
            translate("automationTemplates.email-payment-receipt.guardrails.0"),
            translate("automationTemplates.email-payment-receipt.guardrails.1"),
        ],
        variables: ["ten_khach", "ten_shop", "so_tien", "ma_phieu", "ngay"],
        defaultBody: translate("automationTemplates.email-payment-receipt.defaultBody"),
        authority: {
            action: "send_email",
        },
        defaults: {
            subject: "Bi\u00ean nh\u1eadn thanh to\u00e1n {ma_phieu} t\u1eeb {ten_shop}",
        },
        n8n: {
            webhook: "nivo/email-payment-receipt",
            data: [],
            audience: "customer",
        },
    },
]
