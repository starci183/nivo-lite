import { AUTOMATION_ROUTES } from "@/modules/routes"
import { automationText, automationTimeParts } from "./status"
import type { AutomationValues } from "./status"
import { fillBody } from "./preview"
import type {
    AutomationCardView,
    AutomationRunView,
    AutomationTone,
    AutomationsLanguage,
    AutomationsTranslator,
    DetailView,
    FieldDef,
    GateView,
    MessageView,
    PreviewSample,
    RunRowView,
    SettingFieldView,
    ShopContext,
} from "@/modules/types"

const BODY_MAX = 600
const EMAIL_BODY_MAX = 4000
const RUNS_MAX = 20

const RUN_LABEL: Readonly<Record<AutomationRunView["status"], string>> = {
    queued: "runRunning",
    running: "runRunning",
    done: "runDone",
    skipped: "runSkipped",
    waiting_approval: "runWaiting",
    failed: "runFailed",
}

const RUN_TONE: Readonly<Record<AutomationRunView["status"], AutomationTone>> = {
    queued: "neutral",
    running: "neutral",
    done: "success",
    skipped: "neutral",
    waiting_approval: "warning",
    failed: "danger",
}

const GATE_LINE = { auto: "gateAuto", ask: "gateAsk", never: "gateNever" } as const

/** The words every section of the detail needs. */
export interface DetailContext {
    readonly t: AutomationsTranslator
    readonly locale: AutomationsLanguage
    /** A moment as the reader reads it. */
    readonly when: (iso: string) => string
}

/** What the screen state says about the open card. */
export interface DetailInput {
    readonly card: AutomationCardView
    readonly runs: ReadonlyArray<AutomationRunView>
    readonly shop: ShopContext
    /** The sample values and neutral words of the message preview. */
    readonly sample: PreviewSample
    readonly values: AutomationValues
    readonly body: string
    readonly note: "proposal" | "fallback" | null
    readonly isBusy: boolean
    readonly isComposing: boolean
    readonly isStarting: boolean
    readonly isStarted: boolean
    readonly isSaved: boolean
    readonly isAwaiting: boolean
    readonly isNested: boolean
    readonly errorText: string | undefined
}

const fieldOf = (
    def: FieldDef,
    card: AutomationCardView,
    values: AutomationValues,
    ctx: DetailContext,
): SettingFieldView => {
    const base = {
        key: def.key,
        id: `automation-${card.key}-${def.key}`,
        label: automationText(def.label, ctx.locale),
        ...(def.hint === undefined ? {} : { description: automationText(def.hint, ctx.locale) }),
    }
    const value = values[def.key]
    if (def.kind === "number") return { ...base, kind: "number", min: def.min, max: def.max, value: Number(value) }
    if (def.kind === "time") return { ...base, kind: "time", ...automationTimeParts(value) }
    if (def.kind === "toggle") return { ...base, kind: "toggle", isOn: value === true }
    const limit = def.maxLength === undefined ? {} : { maxLength: def.maxLength }
    return { ...base, kind: "text", value: String(value ?? ""), ...limit }
}

const messageOf = (input: DetailInput, ctx: DetailContext): MessageView | undefined => {
    const { card, shop } = input
    if (card.def.defaultBody === null) return undefined
    const { t } = ctx
    const text = input.body.trim()
    const firstApproval = card.body === null
    const noteKey = input.note === "proposal" ? "proposalNote" : "fallbackNote"
    return {
        sectionLabel: t("messageTitle"),
        title: t("messageTitle"),
        help: t("messageHelp"),
        ...(card.bodyStale
            ? { staleAlert: { title: t("staleTitle"), body: t("staleBody"), actionLabel: t("regenerate") } }
            : {}),
        bodyId: `automation-${card.key}-body`,
        bodyLabel: t("messageLabel"),
        bodyValue: input.body,
        maxLength: card.def.executor === "n8n" ? EMAIL_BODY_MAX : BODY_MAX,
        ...(input.note === null ? {} : { note: t(noteKey) }),
        variablesTitle: t("variablesTitle"),
        variables: card.def.variables.map((name) => `{${name}}`),
        ...(firstApproval && !card.enabled ? { enableLabel: t("enableWithBody") } : {}),
        saveLabel: t("saveBody"),
        composeLabel: input.isComposing ? t("composing") : t("compose"),
        previewTitle: t("previewTitle"),
        previewText: fillBody(
            input.body,
            { ...input.sample.variables, ten_shop: shop.shop, gio_mo_cua: shop.hours },
            input.sample.neutral,
        ),
        ...(shop.tone === "" ? {} : { toneNote: t("previewTone", { tone: shop.tone }) }),
        isBusy: input.isBusy,
        isComposing: input.isComposing,
        canEnable: text.length > 0 && card.missing.length === 0,
        canSave: text.length > 0 && input.body !== (card.body ?? ""),
        isFirstApproval: firstApproval,
    }
}

const modeKeyOf = (card: AutomationCardView): string | null => {
    if (card.def.contentMode === "ai_per_case") return "modeAi"
    return card.def.contentMode === "fixed" ? "modeFixed" : null
}

const gateOf = (card: AutomationCardView, ctx: DetailContext): GateView | undefined => {
    const { t } = ctx
    const { def } = card
    const line = card.gate === null ? null : GATE_LINE[card.gate]
    const mode = modeKeyOf(card)
    const hasAuthority = def.authority.action !== null
    if (!hasAuthority && mode === null && def.guardrails.length === 0) return undefined
    return {
        sectionLabel: t("gateTitle"),
        ...(hasAuthority
            ? {
                  authority: {
                      title: t("gateTitle"),
                      ...(line === null ? {} : { gateLine: t(line) }),
                      ...(def.authority.alwaysAsk === true ? { alwaysAskLine: t("alwaysAsk") } : {}),
                      ...(card.trust.autoSend ? { autoSendLine: t("autoSendOn") } : {}),
                  },
              }
            : {}),
        ...(mode === null ? {} : { modeLine: t(mode) }),
        ...(card.trust.offered && !card.trust.autoSend
            ? {
                  trust: {
                      title: t("trustOffer", { n: card.trust.streak }),
                      yesLabel: t("trustYes"),
                      noLabel: t("trustNo"),
                  },
              }
            : {}),
        ...(def.guardrails.length === 0
            ? {}
            : {
                  guardrails: {
                      title: t("guardrailsTitle"),
                      items: def.guardrails.map((guardrail) => automationText(guardrail, ctx.locale)),
                  },
              }),
    }
}

const runRowOf = (run: AutomationRunView, ctx: DetailContext): RunRowView => {
    const sent = run.status === "done" && run.message !== null
    return {
        id: run.id,
        statusLabel: ctx.t(sent ? "runSent" : RUN_LABEL[run.status]),
        tone: RUN_TONE[run.status],
        whenText: ctx.when(run.createdAt),
        summary: run.summary,
        ...(run.status === "waiting_approval" ? { decisionsHref: AUTOMATION_ROUTES.decisions } : {}),
        ...(run.error === null ? {} : { errorText: run.error }),
        ...(run.message === null ? {} : { message: run.message }),
        ...(run.evidence === null ? {} : { evidence: run.evidence }),
    }
}

/** Everything the detail of the open card shows: settings, wording, what happens to it, its recent runs. */
export const automationDetailOf = (input: DetailInput, ctx: DetailContext): DetailView => {
    const { card } = input
    const { t } = ctx
    const message = messageOf(input, ctx)
    const gate = gateOf(card, ctx)
    const canRun = card.def.executor === "n8n" && card.def.trigger.kind === "schedule" && card.enabled
    return {
        frame: {
            name: automationText(card.def.name, ctx.locale),
            description: automationText(card.def.description, ctx.locale),
            closeLabel: t("detailClose"),
            dismissLabel: t("dismiss"),
            ...(input.isAwaiting ? { awaitingText: t("needsMessage") } : {}),
            ...(input.errorText === undefined ? {} : { errorText: input.errorText }),
            isBusy: input.isBusy,
            isNested: input.isNested,
        },
        ...(canRun
            ? {
                  runNow: {
                      label: t("runNow"),
                      isPending: input.isStarting,
                      ...(input.isStarted ? { startedText: t("runNowStarted") } : {}),
                  },
              }
            : {}),
        settings: {
            sectionLabel: t("settingsTitle"),
            fields: card.def.settings.map((def) => fieldOf(def, card, input.values, ctx)),
            saveLabel: t("save"),
            ...(input.isSaved ? { savedText: t("saved") } : {}),
            isBusy: input.isBusy,
        },
        ...(message === undefined ? {} : { message }),
        ...(gate === undefined ? {} : { gate }),
        runs: {
            title: t("runsTitle"),
            emptyText: t("runsEmpty"),
            decisionsLabel: t("runOpenDecisions"),
            moreLabel: t("runMore"),
            messageLabel: t("runMessage"),
            evidenceLabel: t("runEvidence"),
            rows: input.runs.slice(0, RUNS_MAX).map((run) => runRowOf(run, ctx)),
        },
    }
}
