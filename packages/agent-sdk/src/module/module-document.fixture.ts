import type { ModuleDocument } from "./module-document.types"

const TEXT = { vi: "v", en: "e" }
const LIST = { vi: ["v"], en: ["e"] }

/** A minimal sound module document of key `sales` with a `main` workbench rooted at `test.stack`. */
export const moduleFixture = (): ModuleDocument => ({
    schema: "nivo/module@1",
    key: "sales",
    version: 1,
    changelog: "First version.",
    breaking: false,
    manifest: {
        order: 20,
        name: TEXT,
        shortName: TEXT,
        description: TEXT,
        points: LIST,
        purpose: "p",
        icon: "i",
        glyph: "g",
        mascot: "m",
        category: "c",
        status: "stable",
        audience: "customer",
        includedWithWorkspace: false,
        available: true,
        knowledgeFolder: "sales",
        settingsExtras: null,
        requires: { capabilities: [], connections: [], roles: { requires: ["identity.find"], uses: [] } },
        connectionProviders: [],
        defaultOperatingMode: "assist",
        multiInstance: false,
    },
    template: {
        agent: { label: TEXT, handle: "sales", summary: TEXT, capabilities: LIST, role: TEXT, instructions: TEXT },
        gates: [
            {
                key: "g",
                label: TEXT,
                hint: TEXT,
                writes: [
                    { kind: "fact", subjectType: "product", attributeLabel: "price", scope: "public" },
                    { kind: "rule", action: "order", field: "mode" },
                ],
            },
        ],
        authorityActions: [
            {
                action: "order",
                label: TEXT,
                mode: "ask",
                limitVnd: null,
                requiredFields: [],
                amountLimit: false,
                maxMode: null,
                note: TEXT,
                next: [],
            },
        ],
        accepts: [{ command: "order", action: "order", subjectType: "lead", requiredFields: [], description: TEXT }],
        triggers: [{ key: "t", preset: "daily_at", atTime: "09:00", probeKey: "p" }],
        rights: [{ kind: "order", access: "read", scope: "turn", fields: ["id", "total"] }],
    },
    contracts: {
        limits: { l: { text: { key: "k" }, member: "total", trusts: ["outsider"] } },
        members: {
            total: { type: "integer", minimum: 0, maximum: 10, nullable: true },
            note: { type: "string", maxLength: 10, enum: ["a"] },
            ok: { type: "boolean" },
            lines: {
                type: "array",
                items: {
                    type: "object",
                    properties: { q: { type: "number", minimum: 0, maximum: 1 } },
                    required: ["q"],
                },
                maxItems: 3,
                minItems: 1,
            },
        },
        signals: [{ key: "s", question: TEXT, requires: { intent: "order", member: "total" } }],
        effects: ["sales.order-recorded"],
        claims: {
            recorded: { requires: "sales.order-recorded", phrases: { vi: ["da ghi"], en: ["recorded"] }, line: TEXT },
        },
        outcomes: {
            o: {
                rules: [
                    {
                        when: {
                            all: [
                                { signal: "s" },
                                { missing: "total" },
                                { check: "c" },
                                { fact: { subjectType: "a", attributeLabel: "b" } },
                            ],
                        },
                        then: { pending: "total" },
                    },
                    { when: { signal: "s" }, then: "decline" },
                ],
                otherwise: "act",
            },
        },
        intents: [
            {
                intent: "order",
                triggers: ["customer_message"],
                answers: true,
                ownTurn: false,
                task: TEXT,
                limits: ["l"],
                result: "nivo.customer-reply",
                owns: [],
                required: [{ member: "total", ask: TEXT }],
                checks: [{ id: "nivo.positive", params: { path: "total" } }],
                claims: ["recorded"],
                outcome: "o",
                policy: null,
            },
            {
                intent: "gateway_call",
                triggers: [],
                answers: false,
                ownTurn: true,
                task: TEXT,
                limits: [],
                result: "nivo.customer-reply",
                owns: [],
                required: [],
                checks: [],
                claims: [],
                outcome: null,
                policy: null,
            },
        ],
    },
    workbenches: {
        main: {
            schema: "nivo/workbench-spec@2",
            module: "sales",
            views: [
                {
                    id: "main",
                    label: TEXT,
                    root: { id: "root", block: "test.stack", props: { gap: "row" } },
                },
            ],
        },
    },
})
