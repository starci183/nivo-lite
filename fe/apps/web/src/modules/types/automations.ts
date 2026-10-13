
/** The translator of the automations messages. */
export type AutomationsTranslator = (key: string, values?: Record<string, string | number>) => string

/** The reader language of the product. */
export type AutomationsLanguage = "vi" | "en"

/** The tone of a badge. */
export type AutomationTone = "success" | "neutral" | "warning" | "danger"

/** The icon word of a template. */
export type AutomationIconWord =
    | "payment"
    | "leads"
    | "report"
    | "review"
    | "debt"
    | "winback"
    | "moon"
    | "sheet"
    | "calendar"
    | "cart"
    | "contract"
    | "truck"
    | "receipt"
    | "ledger"

/** The Google accounts picker of a card that writes a spreadsheet. */
export interface AccountsView {
    readonly label: string
    readonly description: string
    readonly options: ReadonlyArray<{ readonly id: string; readonly label: string; readonly isDisabled: boolean }>
    readonly value: string | null
    readonly isPending: boolean
}

/** One card, every word already in the reader language. */
export interface CardView {
    readonly dataKey: string
    readonly name: string
    readonly description: string
    readonly triggerLine: string
    readonly statusLabel: string
    readonly statusTone: AutomationTone
    readonly icon: AutomationIconWord
    readonly note?: { readonly text: string; readonly link?: { readonly href: string; readonly label: string } }
    readonly sheet?: { readonly href: string; readonly label: string }
    readonly selectLabel: string
    readonly switchLabel: string
    readonly switchName: string
    readonly isSelected: boolean
    readonly isEnabled: boolean
    readonly isSwitchDisabled: boolean
    readonly accounts?: AccountsView
}

/** One setting of a template as the form edits it. */
export type SettingFieldView = {
    readonly key: string
    readonly id: string
    readonly label: string
    readonly description?: string
} & (
    | { readonly kind: "number"; readonly min: number; readonly max: number; readonly value: number }
    | { readonly kind: "time"; readonly hour: number; readonly minute: number }
    | { readonly kind: "toggle"; readonly isOn: boolean }
    | { readonly kind: "text"; readonly maxLength?: number; readonly value: string }
)

/** The message section, every word already in the reader language. */
export interface MessageView {
    readonly sectionLabel: string
    readonly title: string
    readonly help: string
    readonly staleAlert?: { readonly title: string; readonly body: string; readonly actionLabel: string }
    readonly bodyId: string
    readonly bodyLabel: string
    readonly bodyValue: string
    readonly maxLength: number
    readonly note?: string
    readonly variablesTitle: string
    readonly variables: ReadonlyArray<string>
    readonly enableLabel?: string
    readonly saveLabel: string
    readonly composeLabel: string
    readonly previewTitle: string
    readonly previewText: string
    readonly toneNote?: string
    readonly isBusy: boolean
    readonly isComposing: boolean
    readonly canEnable: boolean
    readonly canSave: boolean
    readonly isFirstApproval: boolean
}

/** The gate section: what happens to the message, how it is written, what NIVO always keeps. */
export interface GateView {
    readonly sectionLabel: string
    readonly authority?: {
        readonly title: string
        readonly gateLine?: string
        readonly alwaysAskLine?: string
        readonly autoSendLine?: string
    }
    readonly modeLine?: string
    readonly trust?: { readonly title: string; readonly yesLabel: string; readonly noLabel: string }
    readonly guardrails?: { readonly title: string; readonly items: ReadonlyArray<string> }
}

/** One run of an automation. */
export interface RunRowView {
    readonly id: string
    readonly statusLabel: string
    readonly tone: AutomationTone
    readonly whenText: string
    readonly summary: string
    readonly decisionsHref?: string
    readonly errorText?: string
    readonly message?: string
    readonly evidence?: string
}

/** The detail of the open card. */
export interface DetailView {
    readonly frame: {
        readonly name: string
        readonly description: string
        readonly closeLabel: string
        readonly dismissLabel: string
        readonly awaitingText?: string
        readonly errorText?: string
        readonly isBusy: boolean
        readonly isNested: boolean
    }
    readonly runNow?: { readonly label: string; readonly isPending: boolean; readonly startedText?: string }
    readonly settings: {
        readonly sectionLabel: string
        readonly fields: ReadonlyArray<SettingFieldView>
        readonly saveLabel: string
        readonly savedText?: string
        readonly isBusy: boolean
    }
    readonly message?: MessageView
    readonly gate?: GateView
    readonly runs: {
        readonly title: string
        readonly emptyText: string
        readonly decisionsLabel: string
        readonly moreLabel: string
        readonly messageLabel: string
        readonly evidenceLabel: string
        readonly rows: ReadonlyArray<RunRowView>
    }
}

/** The whole board as it is drawn. */
export interface AutomationsBoardView {
    readonly filters: {
        readonly label: string
        readonly items: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly selectedId: string
    }
    readonly errorAlert?: { readonly title: string; readonly dismissLabel: string }
    readonly emptyText?: string
    readonly cards: ReadonlyArray<CardView>
    readonly detail?: DetailView
    readonly hidden: {
        readonly title: string
        readonly restoreLabel: string
        readonly items: ReadonlyArray<{ readonly key: string; readonly name: string; readonly isBusy: boolean }>
    }
}

/* ------------------------------------------------------------------ domain model */

/** A text in both languages, as the template definitions carry it. */
export type L = { readonly vi: string; readonly en: string }

/** The module an automation belongs to. */
export type ModuleScope = string

/** The key of one automation template. */
export type TemplateKey = string

/** One setting value of a pipeline. */
export type ConfigValue = string | number | boolean

/** The saved settings of a pipeline, by setting key. */
export type PipelineConfig = Readonly<Record<string, ConfigValue>>

/** What a shop may have, derived from its context, knowledge and data (never asked directly). */
export type Capability =
    | "has_opening_hours"
    | "has_deposits"
    | "has_due_dates"
    | "has_appointments"
    | "sells_online"
    | "has_recurring_contracts"
    | "has_delivery"

/** What the business talks to customers on. */
export type ChannelNeed = "customer_chat"

/** The connections a template needs. */
export type ConnectionNeed = "google" | "webhook" | "smtp"

/** What a template needs before it can be switched on. */
export type Requires = {
    readonly modules: ReadonlyArray<ModuleScope>
    readonly channels: ReadonlyArray<ChannelNeed>
    readonly connections: ReadonlyArray<ConnectionNeed>
    readonly capabilities: ReadonlyArray<Capability>
}

/** One setting on a template card (the message body is separate). */
export type FieldDef =
    | {
          readonly key: string
          readonly kind: "number"
          readonly label: L
          readonly hint?: L
          readonly min: number
          readonly max: number
          readonly suffix?: L
      }
    | {
          readonly key: string
          readonly kind: "text" | "email"
          readonly label: L
          readonly hint?: L
          readonly maxLength?: number
      }
    | { readonly key: string; readonly kind: "time"; readonly label: L; readonly hint?: L }
    | { readonly key: string; readonly kind: "toggle"; readonly label: L; readonly hint?: L }

/** The authority action a customer message goes through; null sends nothing. */
export type GateAction =
    "send_care" | "send_follow_up" | "reply_customer" | "send_email" | "remind_booking" | "send_promo" | null

/** The shape of the message a template sends. */
export type ContentMode = "fixed" | "ai_per_case" | "none"

/** The bundle a template ships in. */
export type TemplatePack = "core" | "email" | "appointments" | "marketplace" | "contracts" | "delivery"

/** Who runs a template: the engine itself, a shared n8n workflow, or nobody yet. */
export type TemplateExecutor = "implemented" | "n8n" | "definition"

/** One ready-made automation of the catalogue, as the back end answers it. */
export type TemplateDef = {
    readonly key: TemplateKey
    readonly version: number
    readonly position: number
    readonly pack: TemplatePack
    readonly executor: TemplateExecutor
    /** executor "n8n": the webhook the engine calls and who receives the email. */
    readonly n8n?: {
        readonly webhook: string
        readonly audience: "owner" | "customer"
        readonly data?: ReadonlyArray<string>
    }
    /** Exactly one owner: a module, or null for a workspace-wide automation. */
    readonly moduleKey: ModuleScope | null
    readonly icon: AutomationIconWord
    readonly name: L
    /** One line. */
    readonly description: L
    /** What starts it: an event every business has, or a schedule. `line` is the plain-words line on the card. */
    readonly trigger: { readonly kind: "event" | "schedule"; readonly event: string; readonly line: L }
    readonly requires: Requires
    readonly settings: ReadonlyArray<FieldDef>
    readonly contentMode: ContentMode
    /** The NIVO frame: what the message must never do. */
    readonly guardrails: ReadonlyArray<L>
    /** The variable names usable in the body, without braces. */
    readonly variables: ReadonlyArray<string>
    /** The starting wording; the shop's own version is generated from its context. */
    readonly defaultBody: L | null
    readonly authority: { readonly action: GateAction; readonly alwaysAsk?: boolean }
    readonly defaults: PipelineConfig
}

/** Where one automation run stands. */
export type AutomationRunStatus = "queued" | "running" | "done" | "skipped" | "waiting_approval" | "failed"

/** One step of a run, as the history shows it. */
export type RunStep = {
    readonly label: string
    readonly status: "done" | "skipped" | "waiting" | "failed"
    readonly detail?: string
}

/** One row of the run history, as the screen shows it. */
export type AutomationRunView = {
    readonly id: string
    readonly pipelineId: string
    readonly templateKey: TemplateKey
    readonly status: AutomationRunStatus
    readonly triggerRef: string
    /** Plain-words one line: "Sent a thank-you to the customer". */
    readonly summary: string
    readonly steps: ReadonlyArray<RunStep>
    readonly evidence: string | null
    readonly error: string | null
    readonly createdAt: string
    readonly finishedAt: string | null
    /** The decision this run is waiting for (Office), when status is waiting_approval. */
    readonly workItemId: string | null
    /** The message that was (or will be) sent, when there is one. */
    readonly message: string | null
}

/** Why a template cannot be switched on yet. `href` is where the owner fixes it. */
export type Missing = {
    readonly kind: "module" | "channel" | "connection" | "capability"
    readonly key: string
    readonly label: L
    readonly href: string
}

/** What will happen to a customer message under the owner's current authority; null sends nothing. */
export type AutomationGateKind = "auto" | "ask" | "never" | null

/** A template card's state, assembled by the back end. */
export type AutomationCardView = {
    readonly key: TemplateKey
    readonly def: TemplateDef
    readonly pipelineId: string | null
    readonly enabled: boolean
    /** The owner pressed "Not for me": hidden from the gallery's proposals until restored. */
    readonly dismissed: boolean
    readonly config: PipelineConfig
    /** The approved message template of this shop (null until the owner approved one). */
    readonly body: string | null
    readonly bodyVersion: number
    /** The context version the body was written from, and the current one. */
    readonly basedOnContext: number | null
    readonly currentContext: number | null
    readonly bodyStale: boolean
    readonly gate: AutomationGateKind
    /** Requirements not met (empty = applicable). */
    readonly missing: ReadonlyArray<Missing>
    /** False for a capability-gated pack whose capability the shop does not have: the gallery does not show it at all. */
    readonly proposed: boolean
    /** executor "definition": the definition and gating exist but nothing runs yet ("coming soon"). */
    readonly comingSoon: boolean
    readonly lastRunAt: string | null
    readonly runCount: number
    /** Trust ladder: consecutive owner approvals without edits, whether "auto-send" is on offer, and whether it was accepted. */
    readonly trust: { readonly streak: number; readonly offered: boolean; readonly autoSend: boolean }
    /** The state of the Google connection, for templates that write a spreadsheet. */
    readonly google?: "ready" | "missing" | "lost" | "unavailable"
    readonly sheetUrl?: string | null
}

/** The shop's real context shown in previews. */
export type ShopContext = { readonly shop: string; readonly hours: string; readonly tone: string }

/** The sample values and the neutral words of a message preview. */
export type PreviewSample = {
    readonly variables: Readonly<Record<string, string>>
    readonly neutral: Readonly<Record<string, string>>
}

/** One connected Google account of the workspace a spreadsheet automation can write with. */
export interface GoogleAccount {
    readonly id: string
    readonly name: string
    readonly status: "connected" | "error"
}
