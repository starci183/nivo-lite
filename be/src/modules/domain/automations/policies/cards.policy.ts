import type { LocalizedText, TemplateDefinition } from "@modules/domain/automation-templates"
import type {
    AutomationCard,
    GateMode,
    AutomationRunView,
    MissingRequirement,
    OverviewRows,
    ShopFacts,
} from "../automations.contracts"
import type { PipelineRow } from "@modules/domain/automation-pipelines"
import type { RunRow, RunStatus, RunStep } from "@modules/domain/automation-runs"
import { isTemplateKey, resolveConfig } from "./config.policy"
import { contextVersionFor, gateModeFor } from "./context.policy"
import type { ActiveContexts } from "./context.policy"

/** The label of one missing requirement, in both languages. */
export type RequirementLabeller = (kind: MissingRequirement["kind"], key: string) => LocalizedText

/** Which requirements of a template the shop does not meet yet. */
export const missingFor = (
    def: TemplateDefinition,
    facts: ShopFacts,
    label: RequirementLabeller,
): ReadonlyArray<MissingRequirement> => [
    ...def.requires.modules
        .filter((key) => !facts.installed.includes(key))
        .map((key): MissingRequirement => ({ kind: "module", key, label: label("module", key) })),
    ...def.requires.channels
        .filter((key) => key === "customer_chat" && !facts.hasChat)
        .map((key): MissingRequirement => ({ kind: "channel", key, label: label("channel", key) })),
    ...def.requires.connections
        .filter((key) => !facts.connections.some((connection) => connection.provider === key))
        .map((key): MissingRequirement => ({ kind: "connection", key, label: label("connection", key) })),
    ...def.requires.capabilities
        .filter((key) => !facts.capabilities.has(key))
        .map((key): MissingRequirement => ({ kind: "capability", key, label: label("capability", key) })),
]

const summaryOf = (steps: ReadonlyArray<RunStep>, status: RunStatus): string => {
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
        steps: steps.map(({ label, status, detail }) => ({ label, status, detail })),
        evidence: row.evidence,
        error: row.error,
        createdAt: row.created_at,
        finishedAt: row.finished_at,
        workItemId: steps.find((step) => step.workItemId)?.workItemId ?? null,
        message: steps.find((step) => step.message)?.message ?? null,
    }
}

/** The run views of the runs whose pipeline has a known template, newest first as the rows come. */
export const runViewsOf = (
    runs: ReadonlyArray<RunRow>,
    pipelines: ReadonlyArray<Pick<PipelineRow, "id" | "template_key">>,
): ReadonlyArray<AutomationRunView> => {
    const keyOf = new Map(
        pipelines.filter((pipeline) => isTemplateKey(pipeline.template_key)).map((p) => [p.id, p.template_key]),
    )
    return runs.flatMap((run) => {
        const key = keyOf.get(run.pipeline_id)
        return key === undefined ? [] : [runViewOf(run, key)]
    })
}

/** The inputs of the card assembly that are not rows. */
export interface CardInputs {
    /** The rows of the overview. */
    readonly rows: OverviewRows
    /** The templates of the catalogue. */
    readonly templates: ReadonlyArray<TemplateDefinition>
    /** The active contexts. */
    readonly contexts: ActiveContexts
    /** The facts the requirements are checked against. */
    readonly facts: ShopFacts
    /** The history of every pipeline of the workspace. */
    readonly runs: ReadonlyArray<AutomationRunView>
    /** The label of one missing requirement. */
    readonly label: RequirementLabeller
}

/** The state of the Google connection a spreadsheet template depends on, with the spreadsheet link. */
interface GoogleCard {
    readonly state: NonNullable<AutomationCard["google"]>
    readonly sheetUrl: string | null
}

const googleOf = (google: OverviewRows["google"]): GoogleCard => {
    if (google === null || google.status === "pending") return { state: "missing", sheetUrl: null }
    const sheetUrl = google.public_meta?.sheet_url || null
    if (google.status === "error")
        return { state: google.last_error?.startsWith("consent:") ? "unavailable" : "lost", sheetUrl }
    return { state: "ready", sheetUrl }
}

/** What happens to a customer message of a template: always asked, never sent, or by the owner's rule for its action. */
const gateOf = (def: TemplateDefinition, input: CardInputs): GateMode | null => {
    if (def.authority.alwaysAsk) return "ask"
    return def.authority.action === null
        ? null
        : gateModeFor(def.authority.action, input.rows.rules, input.contexts.operatingModes)
}

/** One card per template: its switch, settings, message, gate, what is missing and what the history says. */
export const buildCards = (input: CardInputs): ReadonlyArray<AutomationCard> => {
    const rowOf = new Map(input.rows.pipelines.map((pipeline) => [pipeline.template_key, pipeline]))
    const google = googleOf(input.rows.google)
    return input.templates.map((def): AutomationCard => {
        const row = rowOf.get(def.key)
        const mine = input.runs.filter((run) => run.templateKey === def.key)
        const config = resolveConfig(def, row?.config)
        const missing = missingFor(def, input.facts, input.label)
        const currentContext = contextVersionFor(def.moduleKey, input.contexts.versions)
        const gated = def.pack !== "core" && missing.some((item) => item.kind === "capability")
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
            bodyStale:
                Boolean(row?.body) &&
                row?.based_on_context !== null &&
                row?.based_on_context !== undefined &&
                currentContext !== null &&
                row.based_on_context !== currentContext,
            gate: gateOf(def, input),
            missing,
            proposed: !gated,
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
