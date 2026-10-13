/** A text in both languages the product speaks. */
export interface LocalizedText {
    /** Vietnamese. */
    readonly vi: string
    /** English. */
    readonly en: string
}

/** The value of one setting of a template. */
export type ConfigValue = string | number | boolean

/** What a shop may have, derived from its active context, knowledge and data (never asked directly). */
export type Capability =
    | "has_opening_hours"
    | "has_deposits"
    | "has_due_dates"
    | "has_appointments"
    | "sells_online"
    | "has_recurring_contracts"
    | "has_delivery"

/** What a template needs before it can be switched on. */
export interface TemplateRequirements {
    /** The modules that must be installed. */
    readonly modules: ReadonlyArray<string>
    /** The channels the business must talk to customers on (`customer_chat`). */
    readonly channels: ReadonlyArray<string>
    /** The connections that must exist (`google`, `webhook`, `smtp`). */
    readonly connections: ReadonlyArray<string>
    /** The capabilities the shop must have. */
    readonly capabilities: ReadonlyArray<Capability>
}

/** One setting on a template card; the message body is separate (see `contentMode`). */
export interface SettingDefinition {
    /** The key in the pipeline config. */
    readonly key: string
    /** How the value is entered and coerced. */
    readonly kind: "number" | "text" | "email" | "time" | "toggle" | "textarea"
    /** The label of the field. */
    readonly label: LocalizedText
    /** A line of help under the field. */
    readonly hint?: LocalizedText
    /** The smallest number (kind number). */
    readonly min?: number
    /** The biggest number (kind number). */
    readonly max?: number
    /** The unit shown after the number (kind number). */
    readonly suffix?: LocalizedText
    /** The longest text (kinds text and email). */
    readonly maxLength?: number
    /** True when the field must be filled. */
    readonly required?: boolean
}

/** The shape of the message a template sends. */
export type ContentMode = "fixed" | "ai_per_case" | "none"

/** Who runs a template: the engine itself, a shared n8n workflow, or nobody yet. */
export type TemplateExecutor = "implemented" | "n8n" | "definition"

/** Where a shared n8n workflow listens and who receives its email. */
export interface TemplateN8n {
    /** The webhook path under the n8n base. */
    readonly webhook: string
    /** The data endpoints (`GET /api/n8n/data/<name>`) the workflow reads; documentation that travels with the stored definition. */
    readonly data?: ReadonlyArray<string>
    /** Who receives the email: the owner, or the customer through the authority gate. */
    readonly audience: "owner" | "customer"
}

/** What starts a template: an event every business has, or a schedule. */
export interface TemplateTrigger {
    /** `event` fires when something happens, `schedule` on a clock. */
    readonly kind: "event" | "schedule"
    /** The event name, for example `payment.received`, or the schedule, for example `schedule.daily`. */
    readonly event: string
    /** The plain-words line on the card. */
    readonly line: LocalizedText
}

/** The authority action a template's customer message goes through. */
export interface TemplateAuthority {
    /** The action; null sends nothing to a customer. */
    readonly action: string | null
    /** True when the owner always decides, whatever the rule says. */
    readonly alwaysAsk?: boolean
}

/** One ready-made automation of the catalogue. */
export interface TemplateDefinition {
    /** The stable key, lower case with `_` or `-`. */
    readonly key: string
    /** The version of the definition. */
    readonly version: number
    /** Where the card sorts in the gallery. */
    readonly position: number
    /** The pack: `core`, `email`, `appointments`, `marketplace`, `contracts` or `delivery`. */
    readonly pack: string
    /** Who runs it. */
    readonly executor: TemplateExecutor
    /** For executor `n8n`: the webhook path and who receives the email. */
    readonly n8n?: TemplateN8n
    /** The one module that owns it, or null for a workspace-wide automation. */
    readonly moduleKey: string | null
    /** The icon word of the card. */
    readonly icon: string
    /** The name of the card. */
    readonly name: LocalizedText
    /** One line. */
    readonly description: LocalizedText
    /** What starts it: an event every business has, or a schedule; `line` is the plain-words line on the card. */
    readonly trigger: TemplateTrigger
    /** What it needs. */
    readonly requires: TemplateRequirements
    /** The settings the owner can change. */
    readonly settings: ReadonlyArray<SettingDefinition>
    /** The shape of the message it sends. */
    readonly contentMode: ContentMode
    /** What the message must never do; shown to the owner and given to the model. */
    readonly guardrails: ReadonlyArray<LocalizedText>
    /** The variable names the body may use, without braces. */
    readonly variables: ReadonlyArray<string>
    /** The starting wording; the shop's own version is generated from its context. */
    readonly defaultBody: LocalizedText | null
    /** The authority action a customer message goes through; null sends nothing to a customer. */
    readonly authority: TemplateAuthority
    /** The starting values of the settings. */
    readonly defaults: Readonly<Record<string, ConfigValue>>
}
