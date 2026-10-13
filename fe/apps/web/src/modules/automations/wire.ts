import type {
    AutomationCardType,
    AutomationGoogleAccountType,
    AutomationRunType,
    AutomationsOverviewType,
    LocalizedTextType,
    MissingRequirementType,
    PreviewSampleType,
    RunStepType,
    TemplateDefinitionType,
    TemplateSettingType,
} from "@/modules/api"
import { isModuleKey } from "@/modules/catalog"
import { AUTOMATION_ROUTES, newModulePath } from "@/modules/routes"
import type {
    AutomationCardView,
    AutomationGateKind,
    AutomationIconWord,
    AutomationRunStatus,
    AutomationRunView,
    Capability,
    ChannelNeed,
    ConfigValue,
    ConnectionNeed,
    ContentMode,
    FieldDef,
    GateAction,
    GoogleAccount,
    BilingualLabel,
    Missing,
    PipelineConfig,
    PreviewSample,
    Requires,
    RunStep,
    ShopContext,
    TemplateDef,
    TemplateExecutor,
    TemplatePack,
} from "@/modules/types"

const CAPABILITIES: ReadonlySet<string> = new Set<Capability>([
    "has_opening_hours",
    "has_deposits",
    "has_due_dates",
    "has_appointments",
    "sells_online",
    "has_recurring_contracts",
    "has_delivery",
])

const PACKS: ReadonlySet<string> = new Set<TemplatePack>([
    "core",
    "email",
    "appointments",
    "marketplace",
    "contracts",
    "delivery",
])

const EXECUTORS: ReadonlySet<string> = new Set<TemplateExecutor>(["implemented", "n8n", "definition"])

const ICONS: ReadonlySet<string> = new Set<AutomationIconWord>([
    "payment",
    "leads",
    "report",
    "review",
    "debt",
    "winback",
    "moon",
    "sheet",
    "calendar",
    "cart",
    "contract",
    "truck",
    "receipt",
    "ledger",
])

const GATE_ACTIONS: ReadonlySet<string> = new Set<NonNullable<GateAction>>([
    "send_care",
    "send_follow_up",
    "reply_customer",
    "send_email",
    "remind_booking",
    "send_promo",
])

const CONTENT_MODES: ReadonlySet<string> = new Set<ContentMode>(["fixed", "ai_per_case", "none"])

const GATES: ReadonlySet<string> = new Set<NonNullable<AutomationGateKind>>(["auto", "ask", "never"])

const GOOGLE_STATES: ReadonlySet<string> = new Set(["ready", "missing", "lost", "unavailable"])

const RUN_STATUSES: ReadonlySet<string> = new Set<AutomationRunStatus>([
    "queued",
    "running",
    "done",
    "skipped",
    "waiting_approval",
    "failed",
])

const STEP_STATUSES: ReadonlySet<string> = new Set<RunStep["status"]>(["done", "skipped", "waiting", "failed"])

const MISSING_KINDS: ReadonlySet<string> = new Set<Missing["kind"]>(["module", "channel", "connection", "capability"])

const CONNECTION_NEEDS: ReadonlySet<string> = new Set<ConnectionNeed>(["google", "webhook", "smtp"])

const CONNECTION_HREF: Readonly<Record<string, string>> = {
    webhook: AUTOMATION_ROUTES.developers,
    smtp: AUTOMATION_ROUTES.connectEmail,
}

const inSet = <T>(set: ReadonlySet<string>, value: string): value is T & string => set.has(value)

const pick = <T>(set: ReadonlySet<string>, value: string | null | undefined, fallback: T): T =>
    value !== null && value !== undefined && inSet<T>(set, value) ? value : fallback

/** The word of the wire, or null when it is absent or unknown. */
const pickOrNull = <T>(set: ReadonlySet<string>, value: string | null | undefined): T | null =>
    value !== null && value !== undefined && inSet<T>(set, value) ? value : null

const text = (value: LocalizedTextType | null | undefined): BilingualLabel => ({
    vi: value?.vi ?? "",
    en: value?.en ?? "",
})

const configOf = (value: unknown): PipelineConfig => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {}
    const out: Record<string, ConfigValue> = {}
    for (const [key, entry] of Object.entries(value))
        if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") out[key] = entry
    return out
}

const requiresOf = (requires: TemplateDefinitionType["requires"]): Requires => ({
    modules: requires.modules.filter((key) => isModuleKey(key)),
    channels: requires.channels.filter((key): key is ChannelNeed => key === "customer_chat"),
    connections: requires.connections.filter((key): key is ConnectionNeed => CONNECTION_NEEDS.has(key)),
    capabilities: requires.capabilities.filter((key): key is Capability => CAPABILITIES.has(key)),
})

const settingOf = (setting: TemplateSettingType): FieldDef => {
    const base = {
        key: setting.key,
        label: text(setting.label),
        ...(setting.hint === null || setting.hint === undefined ? {} : { hint: text(setting.hint) }),
    }
    if (setting.kind === "number") {
        return {
            ...base,
            kind: "number",
            min: setting.min ?? 0,
            max: setting.max ?? 100,
            ...(setting.suffix === null || setting.suffix === undefined ? {} : { suffix: text(setting.suffix) }),
        }
    }
    if (setting.kind === "time") return { ...base, kind: "time" }
    if (setting.kind === "toggle") return { ...base, kind: "toggle" }
    return {
        ...base,
        kind: setting.kind === "email" ? "email" : "text",
        ...(setting.maxLength === null || setting.maxLength === undefined ? {} : { maxLength: setting.maxLength }),
    }
}

const defOf = (def: TemplateDefinitionType): TemplateDef => ({
    key: def.key,
    version: def.version,
    position: def.position,
    pack: pick<TemplatePack>(PACKS, def.pack, "core"),
    executor: pick<TemplateExecutor>(EXECUTORS, def.executor, "definition"),
    ...(def.n8n === null || def.n8n === undefined
        ? {}
        : {
              n8n: {
                  webhook: def.n8n.webhook,
                  audience: def.n8n.audience === "customer" ? "customer" : "owner",
                  ...(def.n8n.data === null || def.n8n.data === undefined ? {} : { data: def.n8n.data }),
              },
          }),
    moduleKey:
        def.moduleKey !== null && def.moduleKey !== undefined && isModuleKey(def.moduleKey) ? def.moduleKey : null,
    icon: pick<AutomationIconWord>(ICONS, def.icon, "report"),
    name: text(def.name),
    description: text(def.description),
    trigger: {
        kind: def.trigger.kind === "event" ? "event" : "schedule",
        event: def.trigger.event,
        line: text(def.trigger.line),
    },
    requires: requiresOf(def.requires),
    settings: def.settings.map(settingOf),
    contentMode: pick<ContentMode>(CONTENT_MODES, def.contentMode, "none"),
    guardrails: def.guardrails.map(text),
    variables: def.variables,
    defaultBody: def.defaultBody === null || def.defaultBody === undefined ? null : text(def.defaultBody),
    authority: {
        action: pickOrNull<NonNullable<GateAction>>(GATE_ACTIONS, def.authority.action),
        ...(def.authority.alwaysAsk === null || def.authority.alwaysAsk === undefined
            ? {}
            : { alwaysAsk: def.authority.alwaysAsk }),
    },
    defaults: configOf(def.defaults),
})

/** The page of a missing requirement, where the owner fixes it. */
const missingHrefOf = (missing: MissingRequirementType): string => {
    if (missing.kind === "module") return newModulePath(missing.key)
    if (missing.kind === "channel") return AUTOMATION_ROUTES.connections
    if (missing.kind === "connection") return CONNECTION_HREF[missing.key] ?? AUTOMATION_ROUTES.connections
    return AUTOMATION_ROUTES.knowledge
}

const missingOf = (missing: MissingRequirementType): Missing => ({
    kind: pick<Missing["kind"]>(MISSING_KINDS, missing.kind, "capability"),
    key: missing.key,
    label: text(missing.label),
    href: missingHrefOf(missing),
})

/** One template card as the board shows it, from the wire type. */
export const automationCardViewOf = (card: AutomationCardType): AutomationCardView => ({
    key: card.key,
    def: defOf(card.def),
    pipelineId: card.pipelineId ?? null,
    enabled: card.enabled,
    dismissed: card.dismissed,
    config: configOf(card.config),
    body: card.body ?? null,
    bodyVersion: card.bodyVersion,
    basedOnContext: card.basedOnContext ?? null,
    currentContext: card.currentContext ?? null,
    bodyStale: card.bodyStale,
    gate: pickOrNull<NonNullable<AutomationGateKind>>(GATES, card.gate),
    missing: card.missing.map(missingOf),
    proposed: card.proposed,
    comingSoon: card.comingSoon,
    lastRunAt: card.lastRunAt ?? null,
    runCount: card.runCount,
    trust: { streak: card.trust.streak, offered: card.trust.offered, autoSend: card.trust.autoSend },
    ...(card.google === null || card.google === undefined
        ? {}
        : { google: pick<NonNullable<AutomationCardView["google"]>>(GOOGLE_STATES, card.google, "missing") }),
    ...(card.sheetUrl === null || card.sheetUrl === undefined ? {} : { sheetUrl: card.sheetUrl }),
})

const stepOf = (step: RunStepType): RunStep => ({
    label: step.label,
    status: pick<RunStep["status"]>(STEP_STATUSES, step.status, "failed"),
    ...(step.detail === null || step.detail === undefined ? {} : { detail: step.detail }),
})

/** One run of the history as the board shows it, from the wire type. */
const automationRunViewOf = (run: AutomationRunType): AutomationRunView => ({
    id: run.id,
    pipelineId: run.pipelineId,
    templateKey: run.templateKey,
    status: pick<AutomationRunStatus>(RUN_STATUSES, run.status, "failed"),
    triggerRef: run.triggerRef,
    summary: run.summary,
    steps: run.steps.map(stepOf),
    evidence: run.evidence ?? null,
    error: run.error ?? null,
    createdAt: run.createdAt,
    finishedAt: run.finishedAt ?? null,
    workItemId: run.workItemId ?? null,
    message: run.message ?? null,
})

const sampleOf = (sample: PreviewSampleType): PreviewSample => {
    const words = (value: unknown): Readonly<Record<string, string>> => {
        if (typeof value !== "object" || value === null || Array.isArray(value)) return {}
        const out: Record<string, string> = {}
        for (const [key, entry] of Object.entries(value)) if (typeof entry === "string") out[key] = entry
        return out
    }
    return { variables: words(sample.variables), neutral: words(sample.neutral) }
}

/** The gallery of the workspace as the board shows it: cards, runs, the shop and the preview sample. */
export interface AutomationsOverviewView {
    readonly cards: ReadonlyArray<AutomationCardView>
    readonly runs: ReadonlyArray<AutomationRunView>
    readonly shop: ShopContext
    readonly sample: PreviewSample
}

/** The gallery of the workspace: cards, runs, the shop and the preview sample, from the wire type. */
export const automationsOverviewOf = (overview: AutomationsOverviewType): AutomationsOverviewView => ({
    cards: overview.cards.map(automationCardViewOf),
    runs: overview.runs.map(automationRunViewOf),
    shop: { shop: overview.shop.shop, hours: overview.shop.hours, tone: overview.shop.tone },
    sample: sampleOf(overview.sample),
})

/** One Google account as the account picker shows it, from the wire type. */
export const googleAccountViewOf = (account: AutomationGoogleAccountType): GoogleAccount => ({
    id: account.id,
    name: account.email,
    status: account.status === "error" ? "error" : "connected",
})
