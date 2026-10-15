/** The values that fill the `{{name}}` blanks of a catalog text. */
export interface TextParams {
    /** The value of a blank, by name. */
    readonly [name: string]: string | number
}

/** A text, or none. */
export type OptionalText = string | null

/** The settings of a pipeline with the shop's approved wording as `body`, as a workflow is told them. */
export interface N8nPipelineConfig {
    /** The value of a setting, by key. */
    readonly [key: string]: unknown
}

/** The variables of an email, by name. */
export interface EmailVariables {
    /** The value of a variable. */
    readonly [name: string]: string | number
}

/** What an email is about (invoice, lead, transaction ids), by name. */
export interface EmailRefs {
    /** The id or number. */
    readonly [name: string]: string | number | null
}

/** Who may receive the email of a workflow. */
export type MailAudience = "owner" | "customer"

/** The run a bearer token speaks for: one run is one workspace. */
export interface N8nRunContext {
    /** The run id. */
    readonly runId: string
    /** The workspace the run belongs to. */
    readonly workspaceId: string
    /** The template key (the workflow). */
    readonly templateKey: string
    /** The pipeline settings with the shop's approved wording as `body`. */
    readonly config: N8nPipelineConfig
}

/** A run context, or none when the token proves nothing. */
export type RunContextOrNone = N8nRunContext | null

/** A run id, or none when the occurrence already started one. */
export type OptionalRunId = string | null

/** What a request presents to prove the run it speaks for. */
export interface RunVerification {
    /** The `Authorization` header. */
    readonly authorization: string | undefined
    /** The run the URL names, when it names one. */
    readonly expectedRunId: string | undefined
}

/** What starts one run of a shared n8n workflow. */
export interface StartN8nRun {
    /** The workspace. */
    readonly workspaceId: string
    /** The template key. */
    readonly templateKey: string
    /** The webhook path of the workflow under the n8n base, for example `nivo/email-daily-report`. */
    readonly webhookPath: string
    /** The pipeline settings with the shop's approved wording as `body`. */
    readonly config: N8nPipelineConfig
    /** What the workflow runs with (a date, a period, an address and variables). */
    readonly data: N8nPipelineConfig
    /** Unique per occurrence: the same key never starts a run twice. */
    readonly dedupe: string
}

/** What an n8n workflow reports when it ends. */
export interface N8nCompletion {
    /** `done`, `failed` or `skipped`; anything else counts as done. */
    readonly status?: unknown
    /** A line of text. */
    readonly summary?: unknown
    /** Counters and details. */
    readonly result?: unknown
}

/** One email as a workflow sends it: the fields are cleaned before they are used. */
export interface N8nRawEmail {
    /** The recipient. */
    readonly to: string
    /** The variables, as sent. */
    readonly variables: unknown
    /** What the email is about, as sent. */
    readonly refs: unknown
    /** Unique per email. */
    readonly dedupe: string | undefined
    /** The attachments, as sent. */
    readonly attachments: unknown
}

/** A file attached to an email. */
export interface N8nAttachment {
    /** The file name. */
    readonly filename: string
    /** The content. */
    readonly content: string
    /** The media type. */
    readonly contentType: string | undefined
    /** How the content is encoded. */
    readonly encoding: "base64" | "utf8"
}

/** One email an n8n workflow asks to send. */
export interface N8nEmailRequest {
    /** The recipient. */
    readonly to: string
    /** The variables of the subject and the body. */
    readonly variables: EmailVariables
    /** What the email is about. */
    readonly refs: EmailRefs
    /** Unique per email: the same key never sends twice. */
    readonly dedupe: string | undefined
    /** The attachments. */
    readonly attachments: ReadonlyArray<N8nAttachment>
}

/** An email to an owner of the workspace. */
export interface OwnerEmail {
    /** The workspace. */
    readonly workspaceId: string
    /** The recipient. */
    readonly to: string
    /** The one-line subject. */
    readonly subject: string
    /** The shop name shown in the layout. */
    readonly shopName: string
    /** The plain-text body; the layout is applied by the mail integration. */
    readonly text: string
    /** The attachments. */
    readonly attachments: ReadonlyArray<N8nAttachment>
    /** What the email is for, for example `daily_report`. */
    readonly purpose: string
    /** What it is about. */
    readonly refs: EmailRefs
}

/** An email to a customer: it goes through the authority gate and the workspace's own mail account. */
export interface CustomerEmail {
    /** The workspace. */
    readonly workspaceId: string
    /** The recipient. */
    readonly to: string
    /** The one-line subject. */
    readonly subject: string
    /** The plain-text body. */
    readonly body: string
    /** What the email is for. */
    readonly purpose: string
    /** What it is about. */
    readonly refs: EmailRefs
    /** Unique per email. */
    readonly dedupeKey: string
    /** The kind of thing the gate files the work under. */
    readonly subjectType: "transaction" | "invoice" | "lead"
    /** The id of that thing. */
    readonly subjectId: string | null
    /** The customer. */
    readonly leadId: string | null
}

/** What the mail integration did with an email. */
export interface MailOutcome {
    /** `sent`, `waiting_decision`, `no_smtp`, `blocked`, `failed`, `rate_limited`, `duplicate`. */
    readonly status: string
    /** How it went out (`smtp`, `platform`, `none`). */
    readonly via?: string | undefined
    /** The work item the gate opened. */
    readonly workItemId?: string | null | undefined
    /** The row of the email log. */
    readonly emailMessageId?: string | null | undefined
    /** The id the mail server gave. */
    readonly messageId?: string | null | undefined
    /** Why it did not go out. */
    readonly error?: string | null | undefined
}

/** The mail of the product: owners are mailed straight, customers through the gate. */
export interface N8nMailer {
    /** Sends an email to an owner of the workspace. */
    sendOwnerEmail(email: OwnerEmail): Promise<MailOutcome>
    /** Asks for an email to a customer to leave through the authority gate. */
    requestCustomerEmail(email: CustomerEmail): Promise<MailOutcome>
}

/** What a workflow is told about an owner. */
export interface OwnerRecipient {
    /** The address. */
    readonly email: string
    /** The name. */
    readonly name: string
}

/** The raw numbers of a day. */
export interface DayNumbers {
    /** The value of a figure, by name. */
    readonly [name: string]: number
}

/** The variables an email is written with, as text. */
export interface TextVariables {
    /** The value of a variable. */
    readonly [name: string]: string
}

/** The figures of a day, for the report. */
export interface DaySummary {
    /** The day, `yyyy-mm-dd`. */
    readonly date: string
    /** The shop name. */
    readonly shop_name: string
    /** The owners to mail. */
    readonly owners: ReadonlyArray<OwnerRecipient>
    /** The raw numbers. */
    readonly numbers: DayNumbers
    /** The variables of the email. */
    readonly variables: TextVariables
}

/** One reminder a debt workflow sends. */
export interface DebtReminderItem {
    /** The customer's address. */
    readonly to: string
    /** Unique per invoice per day. */
    readonly dedupe: string
    /** What it is about. */
    readonly refs: TextVariables
    /** The variables of the email. */
    readonly variables: EmailVariables
}

/** Why some invoices were left out of the reminders. */
export interface DebtSkips {
    /** Invoices whose customer has no address. */
    readonly no_email: number
    /** Invoices reminded about lately. */
    readonly reminded_recently: number
}

/** The overdue invoices a debt workflow reminds about. */
export interface OverdueInvoices {
    /** The shop name. */
    readonly shop_name: string
    /** The reminders, at most fifty. */
    readonly items: ReadonlyArray<DebtReminderItem>
    /** Why some invoices were left out. */
    readonly skipped: DebtSkips
}

/** A month of the ledger, ready to attach to an email to the accountant. */
export interface MonthLedger {
    /** The CSV (UTF-8 with a byte order mark so Excel reads Vietnamese). */
    readonly csv: string
    /** The month, `yyyy-mm`. */
    readonly period: string
    /** The file name. */
    readonly filename: string
    /** How many rows. */
    readonly rows: number
    /** The variables of the email. */
    readonly variables: TextVariables
}

/** The answer to an email request, as the workflow reads it. */
export interface N8nEmailAnswer {
    /** What the mail integration did: `sent`, `waiting_decision`, `no_smtp`, `blocked`, `failed`, `rate_limited`, `duplicate`. */
    readonly status: string
    /** How it went out. */
    readonly via: string | null
    /** The work item the gate opened. */
    readonly workItemId: string | null
    /** The row of the email log. */
    readonly emailMessageId: string | null
    /** The id the mail server gave. */
    readonly messageId: string | null
    /** Why it did not go out. */
    readonly error: string | null
}

/** What a payment receipt run starts with. */
export interface ReceiptRun {
    /** What the workflow runs with: the recipient and the variables of the email. */
    readonly data: N8nPipelineConfig
    /** Unique per payment. */
    readonly dedupe: string
}

/** A receipt run, or none when the payment has no customer address. */
export type ReceiptRunOrNone = ReceiptRun | null
