import { z } from "zod"
import { backgroundStoppedKind, brainChangeKind, chainStoppedKind } from "./engine-message-kinds"

/** Where a message that asks for something stands: it waits for a person, or it ended. `sent` is `approved` for content that leaves the app (a message, a file). */
export const AGENT_MESSAGE_STATES = ["waiting", "approved", "sent", "rejected", "failed", "expired"] as const

/** The state of an agent message that asks for something. */
export type AgentMessageState = (typeof AGENT_MESSAGE_STATES)[number]

/** What the edit command of a kind does: change the payload in place, open its source record, or not exist. */
export type AgentMessageEditMode = "inline" | "source" | "none"

/** The commands a kind allows when the message asks for approval. */
export interface AgentMessageKindActions {
    /** Whether the proposal may be approved as it stands. */
    readonly approve: boolean
    /** How the payload is changed before it is approved. */
    readonly edit: AgentMessageEditMode
    /** Whether the proposal may be rejected. */
    readonly reject: boolean
}

/**
 * One kind of content an agent message carries: its id (`<family>.<name>`), the schema of its payload and the commands it allows. The
 * core draws the shell around any kind; how the payload looks and how it is edited is the renderer a client registers under the same id.
 * A module declares its kinds from its own folder and never touches the core.
 */
export interface AgentMessageKind<S extends z.ZodType = z.ZodType> {
    /** The kind id. */
    readonly id: string
    /** What the payload of this kind is. */
    readonly payload: S
    /** The commands the kind allows. */
    readonly actions: AgentMessageKindActions
}

/** Declares a kind of agent message content. */
export const defineAgentMessageKind = <S extends z.ZodType>(kind: AgentMessageKind<S>): AgentMessageKind<S> => kind

/** The shape of the payload of a plain text message. */
type MessageTextShape = { text: z.ZodString }

/** A plain text to send; edited in place. */
export const messageTextKind: AgentMessageKind<z.ZodObject<MessageTextShape>> = defineAgentMessageKind({
    id: "message.text",
    payload: z.object({ text: z.string().max(4000) }),
    actions: { approve: true, edit: "inline", reject: true },
})

/** The shape of the payload of a table of text cells. */
type RecordsRowsShape = { columns: z.ZodArray<z.ZodString>; rows: z.ZodArray<z.ZodArray<z.ZodString>> }

/** Rows to write somewhere, as a small table of text cells; the source is where they are changed. */
export const recordsRowsKind: AgentMessageKind<z.ZodObject<RecordsRowsShape>> = defineAgentMessageKind({
    id: "records.rows",
    payload: z.object({
        columns: z.array(z.string().max(80)).max(12),
        rows: z.array(z.array(z.string().max(200)).max(12)).max(50),
    }),
    actions: { approve: true, edit: "source", reject: true },
})

/**
 * One fact the engine attaches to a message, in words: a plain label (`name`) and its value. A fact marked `technical` holds a raw
 * value a person cannot read (an error code, an id, the raw words of an error): the card folds it under its technical details and never
 * shows it as the content.
 */
export interface MessageFact {
    /** The plain label a person reads, in the team's language. */
    readonly name: string
    /** The value, in words where a mapping exists. */
    readonly value: string
    /** True for a raw value (a code, an id, raw error words): folded under the technical details, never the content. */
    readonly technical?: boolean | undefined
}

/** The schema of one fact of a message. */
export const messageFactSchema: z.ZodType<MessageFact> = z.object({
    name: z.string().max(80),
    value: z.string().max(400),
    technical: z.boolean().optional(),
})

/** A package's preview of a call or a stop: a kind a PACKAGE registered and its payload (the engine checks it against that kind's schema and drops it when it fails; the card still posts). */
export interface AgentMessagePreview {
    /** The registered kind id (never a core kind). */
    readonly kind: string
    /** The payload, as that kind's schema parsed it. */
    readonly payload: unknown
}

/** The schema of a preview as it is stored: the kind id and any payload (the kind's own schema is checked where the kind is known). */
export const agentMessagePreviewSchema: z.ZodType<AgentMessagePreview> = z.object({ kind: z.string().min(1).max(300), payload: z.unknown() })

/** The step that asks for an approval, in the team's words: the installed node, its title and its description. */
export interface ApprovalDecisionStep {
    /** The installed node (`<module>.<feature>`). */
    readonly nodeId: string
    /** Its title in the team's language. */
    readonly title: string
    /** Its description in the team's language; empty when the node declares none. */
    readonly description: string
}

/** The call an approval is asked for: the tool and the account the ToolRunner picked for it (null for a call on no account). */
export interface ApprovalDecisionCall {
    /** The tool (or effect) id. */
    readonly tool: string
    /** The account, in the owner's words (provider . account name), or null. */
    readonly account: string | null
    /** The tool's worded title in both languages (its plugin's tool label), so a card names the operation without a raw id; absent when none is declared. */
    readonly label?: { readonly vi: string; readonly en: string } | undefined
}

/**
 * What an approval carries (owner chot 2026-11-13, nivo-frame `team-chat` rule 9). The engine's card before a write under `ask` runs
 * holds the step, the call, the facts (worded by code from the REAL arguments), the brief in words and a package's preview when a valid
 * one was given. Every member is optional so a row stored before the card (only `text`, or a `connectionHref`; the text living in the
 * record's summary) still parses and draws.
 */
export interface ApprovalDecisionPayload {
    /** The brief in words; the record's summary stands in when empty. */
    readonly text?: string | undefined
    /** Where the owner connects what the agent needs, when it needs a connection to go on (older rows). */
    readonly connectionHref?: string | undefined
    /** The step that asks. */
    readonly step?: ApprovalDecisionStep | undefined
    /** The call asked for. */
    readonly call?: ApprovalDecisionCall | undefined
    /** The facts, worded by code from the real arguments. */
    readonly facts?: ReadonlyArray<MessageFact> | undefined
    /** A package's preview of the call. */
    readonly preview?: AgentMessagePreview | undefined
    /** What the person approves, IN FULL (the send's text, each image's address), when the tool declares it; absent on older rows. */
    readonly content?: ReadonlyArray<ApprovalContent> | undefined
}

/** The card the ENGINE builds before a write under `ask` runs: the full `approval.decision` payload, its brief always present. */
export interface ApprovalDecisionCard {
    /** The step that asks. */
    readonly step: ApprovalDecisionStep
    /** The call asked for. */
    readonly call: ApprovalDecisionCall
    /** The facts, worded by code from the real arguments. */
    readonly facts: ReadonlyArray<MessageFact>
    /** The AI's brief from the node description, the arguments and the context; the engine's fallback words when the AI failed. */
    readonly text: string
    /** A package's preview, when one was given and passed its kind's schema. */
    readonly preview?: AgentMessagePreview | undefined
    /** What the person approves, IN FULL (the send's text, each image's address), when the tool declares it. */
    readonly content?: ReadonlyArray<ApprovalContent> | undefined
}

/** The longest brief or description of an approval. */
export const APPROVAL_TEXT_MAX = 4000

/** The longest content value an approval carries in full: the customer send's own text maximum. */
export const APPROVAL_CONTENT_MAX = 4000

/** The most content items one approval carries. */
const APPROVAL_CONTENT_ITEMS_MAX = 20

/** One piece of what a person approves, carried in full: a text (`text`) or the address of a file or image (`address`). */
export interface ApprovalContent {
    /** The argument it is (`text`, `images`). */
    readonly name: string
    /** How it is shown: words, or an address to open. */
    readonly kind: "text" | "address"
    /** The value in full. */
    readonly value: string
}

/** The schema of one content item of an approval. */
export const approvalContentSchema: z.ZodType<ApprovalContent> = z.object({
    name: z.string().max(80),
    kind: z.enum(["text", "address"]),
    value: z.string().max(APPROVAL_CONTENT_MAX),
})

/** The longest id, title or account name of an approval. */
const APPROVAL_LINE_MAX = 300

/** The most facts one approval lists. */
export const APPROVAL_FACTS_MAX = 40

/** The step of an approval. */
const approvalStepSchema = z.object({
    nodeId: z.string().max(APPROVAL_LINE_MAX),
    title: z.string().max(APPROVAL_LINE_MAX),
    description: z.string().max(APPROVAL_TEXT_MAX),
})

/** The call of an approval. */
const approvalCallSchema = z.object({
    tool: z.string().max(APPROVAL_LINE_MAX),
    account: z.string().max(APPROVAL_LINE_MAX).nullable(),
    label: z.object({ vi: z.string().max(APPROVAL_LINE_MAX), en: z.string().max(APPROVAL_LINE_MAX) }).optional(),
})

/** The payload schema of `approval.decision`: every member optional, so older rows (only `text` / `connectionHref`) still parse. */
export const approvalDecisionPayload: z.ZodType<ApprovalDecisionPayload> = z.object({
    text: z.string().max(APPROVAL_TEXT_MAX).optional(),
    connectionHref: z.string().max(500).optional(),
    step: approvalStepSchema.optional(),
    call: approvalCallSchema.optional(),
    facts: z.array(messageFactSchema).max(APPROVAL_FACTS_MAX).optional(),
    preview: agentMessagePreviewSchema.optional(),
    content: z.array(approvalContentSchema).max(APPROVAL_CONTENT_ITEMS_MAX).optional(),
})

/** The schema of the card the engine builds (and keeps on its stop): step, call, facts and text required, preview optional. */
export const approvalDecisionCard: z.ZodType<ApprovalDecisionCard> = z.object({
    step: approvalStepSchema,
    call: approvalCallSchema,
    facts: z.array(messageFactSchema).max(APPROVAL_FACTS_MAX),
    text: z.string().max(APPROVAL_TEXT_MAX),
    preview: agentMessagePreviewSchema.optional(),
    content: z.array(approvalContentSchema).max(APPROVAL_CONTENT_ITEMS_MAX).optional(),
})

/** A request for a decision of the engine: the card, then Approve and Refuse wired to the decision. Not edited in place. Core only: no package kind may declare approve or reject. */
export const approvalDecisionKind: AgentMessageKind<z.ZodType<ApprovalDecisionPayload>> = defineAgentMessageKind({
    id: "approval.decision",
    payload: approvalDecisionPayload,
    actions: { approve: true, edit: "none", reject: true },
})

/** What a run report carries: its words (the record's summary stands in when empty) and, on older rows, a connection link. */
export interface ReportRunPayload {
    /** The words of the report. */
    readonly text?: string | undefined
    /** A connection link, on older rows. */
    readonly connectionHref?: string | undefined
}

/** The report of a finished run: its words in the record's summary, the run it opens as the work. Read only. */
export const reportRunKind: AgentMessageKind<z.ZodType<ReportRunPayload>> = defineAgentMessageKind({
    id: "report.run",
    payload: z.object({ text: z.string().max(4000).optional(), connectionHref: z.string().max(500).optional() }),
    actions: { approve: false, edit: "none", reject: false },
})

/** What a `report.facts` message carries: one readable sentence, then the facts behind it. */
export interface ReportFactsPayload {
    /** The readable sentence; no code, no id, no raw value in it. */
    readonly text: string
    /** The facts, worded ones first; raw values only as `technical` facts. */
    readonly facts: ReadonlyArray<MessageFact>
}

/** The payload schema of a `report.facts` message. */
export const reportFactsPayload: z.ZodType<ReportFactsPayload> = z.object({
    text: z.string().max(4000),
    facts: z.array(messageFactSchema).max(40),
})

/** The report of the engine itself (NIVO speaks, not the AI): a readable sentence and its facts. Built by the engine only, never by a tool call. Read only. */
export const reportFactsKind: AgentMessageKind<z.ZodType<ReportFactsPayload>> = defineAgentMessageKind({
    id: "report.facts",
    payload: reportFactsPayload,
    actions: { approve: false, edit: "none", reject: false },
})

/** Who handles a suggested way on: the workflow runs it again, or a person does it. */
export const STOPPED_HANDLERS = ["workflow", "person"] as const

/** The decisions a stopped workflow offers when the AI itself failed: the three freeze decisions. */
export const STOPPED_DECISIONS = ["retry", "take_over", "skip"] as const

const stoppedText = z.string().max(4000)

/** One suggested way on, from the AI, and who would do it. */
export interface StoppedSuggestion {
    /** The message text the node works from. */
    readonly text: string
    /** Which handler takes the suggestion. */
    readonly handledBy: (typeof STOPPED_HANDLERS)[number]
}

/** What a `workflow.stopped` message carries: where the workflow stopped, why, what the engine knows for sure, and the ways on. */
export interface WorkflowStoppedPayload {
    /** The workflow that stopped. */
    readonly workflow: { readonly moduleKey: string; readonly key: string; readonly title: string }
    /** The step that stopped. */
    readonly step: { readonly key: string; readonly nodeId: string; readonly title: string }
    /** The id of the run that stopped. */
    readonly runId: string
    /** The lead the run was working on; null when none. */
    readonly leadId: string | null
    /** The conversation the run was working on; null when none. */
    readonly conversationId: string | null
    /** `ai`: the AI core worded it; `engine`: the AI itself failed and the engine's static words stand in. */
    readonly by: "ai" | "engine"
    /** Why the run stopped. */
    readonly reason: string
    /** What the stop asks the team; null when it asks nothing. */
    readonly question: string | null
    /** True values the engine attached, worded by code (never by a model); raw values only as `technical` facts. */
    readonly facts: ReadonlyArray<MessageFact>
    /** 2 to 3 from the AI; none when the engine speaks. */
    readonly suggestions: ReadonlyArray<StoppedSuggestion>
    /** The freeze decisions, only when the AI itself failed. */
    readonly decisions: ReadonlyArray<(typeof STOPPED_DECISIONS)[number]>
    /** How many times this same step of this run stopped. */
    readonly repeats: number
    /** When the stop first happened (ISO time). */
    readonly firstAt: string
    /** When the stop last happened (ISO time). */
    readonly lastAt: string
    /** When the run went on and ended well after this stop, ISO; absent or null while it still waits. The card then asks nothing. */
    readonly resolvedAt?: string | null | undefined
    /** A package's preview of what the step was doing, when a valid one was given. */
    readonly preview?: AgentMessagePreview | undefined
    /** On a permission request (a write under `ask`): the approval card the engine built before the write, drawn with the stop. */
    readonly decision?: ApprovalDecisionCard | undefined
}

/** The payload schema of the message of a stopped workflow. */
export const workflowStoppedPayload: z.ZodType<WorkflowStoppedPayload> = z.object({
    workflow: z.object({ moduleKey: z.string().max(120), key: z.string().max(120), title: z.string().max(300) }),
    step: z.object({ key: z.string().max(200), nodeId: z.string().max(200), title: z.string().max(300) }),
    runId: z.string().max(100),
    leadId: z.string().max(100).nullable(),
    conversationId: z.string().max(100).nullable(),
    by: z.enum(["ai", "engine"]),
    reason: stoppedText,
    question: stoppedText.nullable(),
    facts: z.array(messageFactSchema).max(40),
    suggestions: z.array(z.object({ text: z.string().min(1).max(300), handledBy: z.enum(STOPPED_HANDLERS) })).max(3),
    decisions: z.array(z.enum(STOPPED_DECISIONS)).max(3),
    repeats: z.number().int().min(1),
    firstAt: z.string().max(40),
    lastAt: z.string().max(40),
    resolvedAt: z.string().max(40).nullable().optional(),
    preview: agentMessagePreviewSchema.optional(),
    decision: approvalDecisionCard.optional(),
})

/** The common team message of a stopped workflow, built by the engine only (never by a tool call). Read only: answers are replies and the freeze decisions. */
export const workflowStoppedKind: AgentMessageKind<z.ZodType<WorkflowStoppedPayload>> = defineAgentMessageKind({
    id: "workflow.stopped",
    payload: workflowStoppedPayload,
    actions: { approve: false, edit: "none", reject: false },
})

/**
 * The kinds the core knows because they name no domain: a text, a table of rows, an approval, a run report, a stopped workflow, the
 * engine's report with facts, a change of the truth graph, a stopped background work and a stopped chain of agents. Media, invoices,
 * payment requests and reports are registered by their modules (never with approve or reject: `packageKindRefusalOf`).
 */
export const coreAgentMessageKinds: ReadonlyArray<AgentMessageKind> = [
    messageTextKind,
    recordsRowsKind,
    approvalDecisionKind,
    reportRunKind,
    workflowStoppedKind,
    reportFactsKind,
    brainChangeKind,
    backgroundStoppedKind,
    chainStoppedKind,
]

/** Why a package's kind is refused: it takes a core kind's id, or it declares approve / reject (only core kinds do). */
export type PackageKindRefusal = "core_kind_id" | "verdict_actions"

/**
 * Why a kind a PACKAGE declares (`defineAgentMessageKind` in its `messageKinds`) is refused, or null when it may be registered. A
 * package may not take a core kind's id, and may not declare approve or reject: a verdict on /chat belongs to the core kinds only
 * (owner chot 2026-11-13, nivo-frame `team-chat` rule 9).
 */
export const packageKindRefusalOf = (kind: AgentMessageKind): PackageKindRefusal | null => {
    if (coreAgentMessageKinds.some((core) => core.id === kind.id)) return "core_kind_id"
    if (kind.actions.approve || kind.actions.reject) return "verdict_actions"
    return null
}

/** The kind with this id among the given ones, or none. */
export const agentMessageKindOf = (kinds: ReadonlyArray<AgentMessageKind>, id: string): AgentMessageKind | undefined =>
    kinds.find((kind) => kind.id === id)
