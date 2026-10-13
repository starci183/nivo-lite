import { resolveConfig } from "@/lib/automation-shared"
import type {
    AutomationCardView,
    AutomationRunView,
    Capability,
    L,
    Missing,
    TemplateDef,
} from "@/lib/automation-shared"
import { AUTOMATION_ROUTES, newModulePath } from "@/modules/routes"
import { contextVersionFor, gateModeFor } from "./automations.context"
import type { ActiveContexts, ShopFacts } from "./automations.context"
import type { OverviewRows, PipelineRow, RunRow } from "./automations.rows"

/** The label of each kind of missing requirement, in both languages. */
export interface RequirementLabels {
    readonly module: (key: string) => L
    readonly channel: (key: string) => L
    readonly connection: (key: string) => L
    readonly capability: (key: Capability) => L
}

const CONNECTION_HREF: Readonly<Record<string, string>> = {
    webhook: AUTOMATION_ROUTES.developers,
    smtp: AUTOMATION_ROUTES.connectEmail,
}

/** Which requirements of a template the shop does not meet yet. */
export const missingFor = (def: TemplateDef, facts: ShopFacts, labels: RequirementLabels): ReadonlyArray<Missing> => [
    ...def.requires.modules
        .filter((key) => !facts.installed.includes(key))
        .map((key): Missing => ({ kind: "module", key, label: labels.module(key), href: newModulePath(key) })),
    ...def.requires.channels
        .filter((key) => key === "customer_chat" && !facts.hasChat)
        .map((key): Missing => ({ kind: "channel", key, label: labels.channel(key), href: AUTOMATION_ROUTES.connections })),
    ...def.requires.connections
        .filter((key) => !facts.connections.some((connection) => connection.provider === key))
        .map(
            (key): Missing => ({
                kind: "connection",
                key,
                label: labels.connection(key),
                href: CONNECTION_HREF[key] ?? AUTOMATION_ROUTES.connections,
            }),
        ),
    ...def.requires.capabilities
        .filter((key) => !facts.capabilities.has(key))
        .map((key): Missing => ({ kind: "capability", key, label: labels.capability(key), href: AUTOMATION_ROUTES.knowledge })),
]

const summaryOf = (steps: NonNullable<RunRow["steps"]>, status: string): string => {
    const last = [...steps].reverse().find((step) => step.detail) ?? steps.at(-1)
    return last ? [last.label, last.detail].filter(Boolean).join(": ") : status
}

/** One run row as the history shows it. */
export const runViewOf = (row: RunRow, templateKey: string): AutomationRunView => {
    const steps = row.steps ?? []
    return {
        id: row.id,
        pipelineId: row.pipeline_id,
        templateKey,
        status: row.status,
        triggerRef: row.trigger_ref,
        summary: summaryOf(steps, row.status),
        steps: steps.map(({ label, status, detail }) => ({ label, status, ...(detail === undefined ? {} : { detail }) })),
        evidence: row.evidence,
        error: row.error,
        createdAt: row.created_at,
        finishedAt: row.finished_at,
        workItemId: steps.find((step) => step.workItemId)?.workItemId ?? null,
        message: steps.find((step) => step.message)?.message ?? null,
    }
}

/** The run views of the runs whose pipeline is known, newest first as the rows come. */
export const runViewsOf = (
    runs: ReadonlyArray<RunRow>,
    pipelines: ReadonlyArray<PipelineRow>,
): ReadonlyArray<AutomationRunView> => {
    const keyOf = new Map(pipelines.map((pipeline) => [pipeline.id, pipeline.template_key]))
    return runs.flatMap((run) => {
        const key = keyOf.get(run.pipeline_id)
        return key === undefined ? [] : [runViewOf(run, key)]
    })
}

/** The inputs of the card assembly that are not rows. */
export interface CardInputs {
    readonly rows: OverviewRows
    readonly templates: ReadonlyArray<TemplateDef>
    readonly contexts: ActiveContexts
    readonly facts: ShopFacts
    readonly runs: ReadonlyArray<AutomationRunView>
    readonly labels: RequirementLabels
}

type GoogleState = NonNullable<AutomationCardView["google"]>

const googleOf = (google: OverviewRows["google"]): { readonly state: GoogleState; readonly sheetUrl: string | null } => {
    if (google === null || google.status === "pending") return { state: "missing", sheetUrl: null }
    const sheetUrl = google.public_meta?.sheet_url || null
    if (google.status === "error") {
        return { state: google.last_error?.startsWith("consent:") ? "unavailable" : "lost", sheetUrl }
    }
    return { state: "ready", sheetUrl }
}

const gateOf = (def: TemplateDef, input: CardInputs): AutomationCardView["gate"] => {
    if (def.authority.alwaysAsk) return "ask"
    return def.authority.action === null
        ? null
        : gateModeFor(def.authority.action, input.rows.rules, input.contexts.operatingModes)
}

const isStale = (row: PipelineRow | undefined, current: number | null): boolean =>
    Boolean(row?.body) && row?.based_on_context != null && current !== null && row.based_on_context !== current

/** One card per template: its switch, settings, message, gate, what is missing and what the history says. */
export const buildCards = (input: CardInputs): ReadonlyArray<AutomationCardView> => {
    const rowOf = new Map(input.rows.pipelines.map((pipeline) => [pipeline.template_key, pipeline]))
    const google = googleOf(input.rows.google)
    return input.templates.map((def): AutomationCardView => {
        const row = rowOf.get(def.key)
        const mine = input.runs.filter((run) => run.templateKey === def.key)
        const config = resolveConfig(def, row?.config)
        const missing = missingFor(def, input.facts, input.labels)
        const currentContext = contextVersionFor(def.moduleKey, input.contexts.versions)
        return {
            key: def.key,
            def,
            pipelineId: row?.id ?? null,
            enabled: row?.enabled ?? false,
            dismissed: row?.dismissed ?? false,
            config,
            body: row?.body ?? null,
            bodyVersion: row?.body_version ?? 0,
            basedOnContext: row?.based_on_context ?? null,
            currentContext,
            bodyStale: isStale(row, currentContext),
            gate: gateOf(def, input),
            missing: [...missing],
            proposed: !(def.pack !== "core" && missing.some((item) => item.kind === "capability")),
            comingSoon: def.executor === "definition",
            lastRunAt: mine[0]?.createdAt ?? null,
            runCount: mine.length,
            trust: {
                streak: row?.approval_streak ?? 0,
                offered: Boolean(row?.trust_offered_at) && !row?.auto_send,
                autoSend: row?.auto_send ?? false,
            },
            ...(def.requires.connections.includes("google")
                ? {
                      google: google.state,
                      sheetUrl: google.sheetUrl ?? (typeof config.sheetUrl === "string" ? config.sheetUrl : null),
                  }
                : {}),
        }
    })
}
