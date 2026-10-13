import type { TemplateDefinition } from "./automation-templates.contracts"

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
        name: {
            vi: "B\u00e1o c\u00e1o cu\u1ed1i ng\u00e0y qua email",
            en: "End-of-day report by email",
        },
        description: {
            vi: "M\u1ed7i ng\u00e0y v\u00e0o gi\u1edd b\u1ea1n ch\u1ecdn, NIVO g\u1eedi ch\u1ee7 shop m\u1ed9t email t\u00f3m t\u1eaft: kh\u00e1ch m\u1edbi, ti\u1ec1n v\u1ec1, ho\u00e1 \u0111\u01a1n qu\u00e1 h\u1ea1n v\u00e0 vi\u1ec7c \u0111ang ch\u1edd b\u1ea1n quy\u1ebft.",
            en: "Every day at the time you pick, NIVO emails the owner a summary: new customers, money in, overdue invoices and decisions waiting.",
        },
        trigger: {
            kind: "schedule",
            event: "schedule.daily",
            line: {
                vi: "M\u1ed7i ng\u00e0y v\u00e0o gi\u1edd b\u1ea1n ch\u1ecdn (gi\u1edd Vi\u1ec7t Nam)",
                en: "Every day at the time you pick (Vietnam time)",
            },
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
                label: {
                    vi: "G\u1eedi l\u00fac",
                    en: "Send at",
                },
            },
            {
                key: "subject",
                kind: "text",
                label: {
                    vi: "Ti\u00eau \u0111\u1ec1 email",
                    en: "Email subject",
                },
            },
        ],
        contentMode: "fixed",
        guardrails: [
            {
                vi: "Ch\u1ec9 d\u00f9ng s\u1ed1 li\u1ec7u c\u00f3 th\u1eadt trong NIVO.",
                en: "Only real figures from NIVO.",
            },
        ],
        variables: ["ten_shop", "ngay", "tom_tat", "viec_cho"],
        defaultBody: {
            vi: "Ch\u00e0o b\u1ea1n,\n\n\u0110\u00e2y l\u00e0 t\u00f3m t\u1eaft ng\u00e0y {ngay} c\u1ee7a {ten_shop}:\n\n{tom_tat}\n\n{viec_cho}\n\nM\u1edf NIVO \u0111\u1ec3 xem chi ti\u1ebft v\u00e0 x\u1eed l\u00fd c\u00e1c vi\u1ec7c \u0111ang ch\u1edd.",
            en: "Hello,\n\nHere is the summary for {ngay} at {ten_shop}:\n\n{tom_tat}\n\n{viec_cho}\n\nOpen NIVO for the details and to handle what is waiting.",
        },
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
        name: {
            vi: "Nh\u1eafc c\u00f4ng n\u1ee3 qua email",
            en: "Payment reminders by email",
        },
        description: {
            vi: "M\u1ed7i ng\u00e0y NIVO t\u00ecm ho\u00e1 \u0111\u01a1n qu\u00e1 h\u1ea1n c\u1ee7a kh\u00e1ch c\u00f3 email v\u00e0 so\u1ea1n m\u1ed9t l\u1eddi nh\u1eafc l\u1ecbch s\u1ef1 cho t\u1eebng kh\u00e1ch. M\u1eb7c \u0111\u1ecbnh h\u1ecfi b\u1ea1n tr\u01b0\u1edbc khi g\u1eedi.",
            en: "Every day NIVO finds overdue invoices of customers with an email and drafts a polite reminder per customer. Asks you before sending by default.",
        },
        trigger: {
            kind: "schedule",
            event: "schedule.daily",
            line: {
                vi: "M\u1ed7i ng\u00e0y v\u00e0o gi\u1edd b\u1ea1n ch\u1ecdn (gi\u1edd Vi\u1ec7t Nam)",
                en: "Every day at the time you pick (Vietnam time)",
            },
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
                label: {
                    vi: "Ki\u1ec3m tra l\u00fac",
                    en: "Check at",
                },
            },
            {
                key: "after_days",
                kind: "number",
                min: 0,
                max: 60,
                suffix: {
                    vi: "ng\u00e0y",
                    en: "days",
                },
                label: {
                    vi: "Nh\u1eafc khi qu\u00e1 h\u1ea1n t\u1eeb",
                    en: "Remind when overdue by",
                },
            },
            {
                key: "repeat_days",
                kind: "number",
                min: 1,
                max: 90,
                suffix: {
                    vi: "ng\u00e0y",
                    en: "days",
                },
                label: {
                    vi: "Kh\u00f4ng nh\u1eafc l\u1ea1i trong",
                    en: "Do not remind again within",
                },
            },
            {
                key: "subject",
                kind: "text",
                label: {
                    vi: "Ti\u00eau \u0111\u1ec1 email",
                    en: "Email subject",
                },
            },
        ],
        contentMode: "fixed",
        guardrails: [
            {
                vi: "L\u1ecbch s\u1ef1, kh\u00f4ng \u0111e do\u1ea1, kh\u00f4ng nh\u1eafc t\u1edbi ph\u00ed ph\u1ea1t.",
                en: "Polite, no threats, no mention of penalties.",
            },
            {
                vi: "Ch\u1ec9 n\u00eau s\u1ed1 ti\u1ec1n, m\u00e3 phi\u1ebfu v\u00e0 h\u1ea1n thanh to\u00e1n c\u00f3 th\u1eadt.",
                en: "Only the real amount, reference and due date.",
            },
        ],
        variables: ["ten_khach", "ten_shop", "so_tien", "ma_phieu", "han", "so_ngay_tre"],
        defaultBody: {
            vi: "Ch\u00e0o {ten_khach},\n\n{ten_shop} xin nh\u1eafc nh\u1eb9 kho\u1ea3n {so_tien} (phi\u1ebfu {ma_phieu}) \u0111\u00e3 \u0111\u1ebfn h\u1ea1n t\u1eeb ng\u00e0y {han}. N\u1ebfu b\u1ea1n \u0111\u00e3 chuy\u1ec3n kho\u1ea3n r\u1ed3i, b\u1ea1n b\u1ecf qua email n\u00e0y gi\u00fap ch\u00fang t\u00f4i nh\u00e9.\n\nC\u1ea7n h\u1ed7 tr\u1ee3 th\u00eam, b\u1ea1n c\u1ee9 tr\u1ea3 l\u1eddi email n\u00e0y.",
            en: "Hello {ten_khach},\n\nA gentle reminder from {ten_shop}: {so_tien} (ref {ma_phieu}) has been due since {han}. If you have already paid, please ignore this email.\n\nIf you need help, just reply to this email.",
        },
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
        name: {
            vi: "S\u1ed5 c\u00e1i th\u00e1ng g\u1eedi k\u1ebf to\u00e1n qua email",
            en: "Monthly ledger to your accountant by email",
        },
        description: {
            vi: "Ng\u00e0y 1 m\u1ed7i th\u00e1ng, NIVO g\u1eedi file CSV s\u1ed5 c\u00e1i c\u1ee7a th\u00e1ng tr\u01b0\u1edbc (ti\u1ec1n v\u1ec1 v\u00e0 ho\u00e1 \u0111\u01a1n) t\u1edbi email k\u1ebf to\u00e1n b\u1ea1n nh\u1eadp.",
            en: "On the 1st of each month NIVO emails last month's ledger CSV (money in and invoices) to the accountant address you enter.",
        },
        trigger: {
            kind: "schedule",
            event: "schedule.monthly",
            line: {
                vi: "Ng\u00e0y 1 m\u1ed7i th\u00e1ng (gi\u1edd Vi\u1ec7t Nam)",
                en: "The 1st of each month (Vietnam time)",
            },
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
                label: {
                    vi: "Email k\u1ebf to\u00e1n",
                    en: "Accountant email",
                },
            },
            {
                key: "time",
                kind: "time",
                label: {
                    vi: "G\u1eedi l\u00fac",
                    en: "Send at",
                },
            },
            {
                key: "subject",
                kind: "text",
                label: {
                    vi: "Ti\u00eau \u0111\u1ec1 email",
                    en: "Email subject",
                },
            },
        ],
        contentMode: "fixed",
        guardrails: [
            {
                vi: "Ch\u1ec9 d\u00f9ng s\u1ed1 li\u1ec7u c\u00f3 th\u1eadt trong NIVO.",
                en: "Only real figures from NIVO.",
            },
        ],
        variables: ["ten_shop", "ky", "tom_tat"],
        defaultBody: {
            vi: "Ch\u00e0o b\u1ea1n,\n\n\u0110\u00ednh k\u00e8m l\u00e0 s\u1ed5 c\u00e1i th\u00e1ng {ky} c\u1ee7a {ten_shop} (file CSV, m\u1edf \u0111\u01b0\u1ee3c b\u1eb1ng Excel).\n\nT\u1ed5ng quan:\n{tom_tat}\n\nEmail n\u00e0y do NIVO g\u1eedi t\u1ef1 \u0111\u1ed9ng v\u00e0o ng\u00e0y 1 h\u1eb1ng th\u00e1ng.",
            en: "Hello,\n\nAttached is the ledger for {ky} of {ten_shop} (a CSV file that opens in Excel).\n\nOverview:\n{tom_tat}\n\nThis email is sent automatically by NIVO on the 1st of each month.",
        },
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
        name: {
            vi: "Bi\u00ean nh\u1eadn thanh to\u00e1n qua email",
            en: "Payment receipt by email",
        },
        description: {
            vi: "Khi ti\u1ec1n v\u1ec1 v\u00e0 kh\u00e1ch c\u00f3 email, NIVO g\u1eedi kh\u00e1ch m\u1ed9t bi\u00ean nh\u1eadn ng\u1eafn. Email cho kh\u00e1ch \u0111i qua b\u01b0\u1edbc ki\u1ec3m tra quy\u1ec1n (m\u1eb7c \u0111\u1ecbnh h\u1ecfi b\u1ea1n tr\u01b0\u1edbc).",
            en: "When money arrives and the customer has an email, NIVO sends a short receipt. Customer emails pass the authority check (asks you first by default).",
        },
        trigger: {
            kind: "event",
            event: "payment.received",
            line: {
                vi: "Khi nh\u1eadn \u0111\u01b0\u1ee3c m\u1ed9t kho\u1ea3n thanh to\u00e1n c\u1ee7a kh\u00e1ch c\u00f3 email",
                en: "When a payment arrives from a customer with an email",
            },
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
                label: {
                    vi: "Ti\u00eau \u0111\u1ec1 email",
                    en: "Email subject",
                },
            },
        ],
        contentMode: "fixed",
        guardrails: [
            {
                vi: "Ch\u1ec9 n\u00eau s\u1ed1 ti\u1ec1n, m\u00e3 phi\u1ebfu v\u00e0 ng\u00e0y c\u00f3 th\u1eadt.",
                en: "Only the real amount, reference and date.",
            },
            {
                vi: "Kh\u00f4ng b\u1ecba ch\u00ednh s\u00e1ch hay \u01b0u \u0111\u00e3i.",
                en: "Never invent policies or offers.",
            },
        ],
        variables: ["ten_khach", "ten_shop", "so_tien", "ma_phieu", "ngay"],
        defaultBody: {
            vi: "Ch\u00e0o {ten_khach},\n\n{ten_shop} x\u00e1c nh\u1eadn \u0111\u00e3 nh\u1eadn {so_tien} cho phi\u1ebfu {ma_phieu} v\u00e0o ng\u00e0y {ngay}.\n\nC\u1ea3m \u01a1n b\u1ea1n \u0111\u00e3 tin t\u01b0\u1edfng {ten_shop}. N\u1ebfu th\u00f4ng tin ch\u01b0a \u0111\u00fang, b\u1ea1n tr\u1ea3 l\u1eddi email n\u00e0y \u0111\u1ec3 ch\u00fang t\u00f4i ki\u1ec3m tra l\u1ea1i.",
            en: "Hello {ten_khach},\n\n{ten_shop} confirms receipt of {so_tien} for {ma_phieu} on {ngay}.\n\nThank you for choosing {ten_shop}. If anything looks wrong, reply to this email and we will check.",
        },
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
