import type { PipelineRow } from "@modules/domain/automation-pipelines"
import type { RunRow } from "@modules/domain/automation-runs"
import type { TemplateDefinition } from "@modules/domain/automation-templates"
import type { InstallationRow, OverviewRows, ShopFacts, ShopPatterns, ShopWithHours } from "@modules/domain/automations"

/** A text in both languages, for a spec. */
export const TEXT = { vi: "Xin chao", en: "Hello" }

/** A template with every field filled; a spec overrides the few fields it reads. */
export const buildTemplate = (overrides: Partial<TemplateDefinition> = {}): TemplateDefinition => ({
    key: "thank_payment",
    version: 1,
    position: 1,
    pack: "core",
    executor: "implemented",
    moduleKey: "sales",
    icon: "payment",
    name: TEXT,
    description: TEXT,
    trigger: { kind: "event", event: "payment.received", line: TEXT },
    requires: { modules: [], channels: [], connections: [], capabilities: [] },
    settings: [],
    contentMode: "none",
    guardrails: [],
    variables: [],
    defaultBody: null,
    authority: { action: null },
    defaults: {},
    ...overrides,
})

/** A pipeline row; a spec overrides the few fields it reads. */
export const buildPipelineRow = (overrides: Partial<PipelineRow> = {}): PipelineRow => ({
    id: "p-1",
    workspace_id: "ws-1",
    template_key: "thank_payment",
    name: "Thank",
    module_key: "sales",
    enabled: true,
    dismissed: false,
    config: {},
    body: null,
    body_version: 0,
    template_version: 1,
    based_on_context: null,
    approval_streak: 0,
    trust_offered_at: null,
    auto_send: false,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
    ...overrides,
})

/** A run row; a spec overrides the few fields it reads. */
export const buildRunRow = (overrides: Partial<RunRow> = {}): RunRow => ({
    id: "r-1",
    pipeline_id: "p-1",
    trigger_ref: "t-1",
    status: "done",
    steps: [],
    evidence: null,
    error: null,
    created_at: "2026-10-02T00:00:00.000Z",
    finished_at: "2026-10-02T00:01:00.000Z",
    ...overrides,
})

/** The rows of an overview with nothing in them; a spec overrides the few it reads. */
export const buildOverviewRows = (overrides: Partial<OverviewRows> = {}): OverviewRows => ({
    installations: [],
    pipelines: [],
    runs: [],
    google: null,
    knowledge: [],
    due_invoices: 0,
    connections: [],
    chat_agents: 0,
    workspace_name: "Tiem Hoa",
    authority: null,
    rules: [],
    contracts: 0,
    shipped_orders: 0,
    ...overrides,
})

/** An installed module with an active context. */
export const buildInstallation = (overrides: Partial<InstallationRow> = {}): InstallationRow => ({
    module_key: "sales",
    operating_mode: null,
    ctx: null,
    ...overrides,
})

/** The facts of a shop that has nothing yet. */
export const buildFacts = (overrides: Partial<ShopFacts> = {}): ShopFacts => ({
    installed: [],
    capabilities: new Set(),
    hasChat: false,
    connections: [],
    ...overrides,
})

/** A shop with its opening hours. */
export const buildShop = (overrides: Partial<ShopWithHours> = {}): ShopWithHours => ({
    shop: "Tiem Hoa",
    hours: "08:00 - 21:00",
    tone: "than thien",
    hoursRange: { from: 480, to: 1260 },
    ...overrides,
})

/** The language data a spec reads a shop with: English words stand in for the catalog. */
export const PATTERNS: ShopPatterns = {
    capabilities: {
        has_deposits: /deposit/i,
        has_appointments: /appointment/i,
        sells_online: /online/i,
        has_recurring_contracts: /subscription/i,
        has_delivery: /delivery/i,
    },
    due: /pay later/i,
    hoursLine: /hours/i,
    negation: /\bno\b|\bnot\b/i,
}

/** Input factories for automation engine scenarios. */
export const template = (key: string, overrides: Partial<TemplateDefinition> = {}) =>
    buildTemplate({ key, ...overrides })
/** Builds a pipeline using its template key as its durable identity. */
export const pipeline = (key: string, overrides: Partial<PipelineRow> = {}) =>
    buildPipelineRow({ id: `p-${key}`, template_key: key, ...overrides })
/** Pairs implemented templates with their enabled pipelines. */
export const setupOf = (...keys: ReadonlyArray<string>) => ({
    pipelines: keys.map((key) => pipeline(key)),
    templates: keys.map((key) => template(key)),
})
/** Pairs one n8n workflow with its configured pipeline. */
export const n8nSetup = (
    key: string,
    definition: Partial<TemplateDefinition> = {},
    row: Partial<PipelineRow> = {},
) => ({
    pipelines: [pipeline(key, row)],
    templates: [template(key, { executor: "n8n", ...definition })],
})

/** Scheduled workflow inputs for the engine. */
export const scheduled = (time = "17:00") =>
    n8nSetup(
        "email-daily-report",
        {
            settings: [{ key: "time", kind: "time", label: { vi: "a", en: "b" } }],
            defaults: { time: "17:00" },
            trigger: { kind: "schedule", event: "schedule.daily", line: { vi: "a", en: "b" } },
            n8n: { webhook: "nivo/daily", audience: "owner" },
        },
        { config: { time } },
    )

/** A received payment that starts engine event scenarios. */
export const paymentEvent = {
    workspaceId: "ws-1",
    event: "payment.received",
    data: { lead_id: "l-1", invoice_id: "i-1" },
    dedupe: "d-1",
}

/** The fixed clock instant for automation engine scenarios. */
export const NOW = "2026-10-12T10:00:00.000Z"

/** A completed executor result with no reported steps. */
export const DONE = { status: "done" as const, steps: [] }

/** Builds the customer payment receipt workflow. */
export const receiptSetup = () =>
    n8nSetup(
        "email-payment-receipt",
        { n8n: { webhook: "nivo/receipt", audience: "customer" } },
        { body: "Dear {ten_khach}" },
    )

/** A template trigger request shared by fireTemplate scenarios. */
export const fireRequest = {
    workspaceId: "ws-1",
    templateKey: "thank_payment",
    dedupe: "d-1",
    triggerRef: "t-1",
    payload: { a: 1 },
}
