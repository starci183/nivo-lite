import { z } from "zod"

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

/** A plain text to send; edited in place. */
export const messageTextKind: AgentMessageKind<z.ZodObject<{ text: z.ZodString }>> = defineAgentMessageKind({
    id: "message.text",
    payload: z.object({ text: z.string().max(4000) }),
    actions: { approve: true, edit: "inline", reject: true },
})

/** Rows to write somewhere, as a small table of text cells; the source is where they are changed. */
export const recordsRowsKind: AgentMessageKind<
    z.ZodObject<{ columns: z.ZodArray<z.ZodString>; rows: z.ZodArray<z.ZodArray<z.ZodString>> }>
> = defineAgentMessageKind({
    id: "records.rows",
    payload: z.object({
        columns: z.array(z.string().max(80)).max(12),
        rows: z.array(z.array(z.string().max(200)).max(12)).max(50),
    }),
    actions: { approve: true, edit: "source", reject: true },
})

/** What an approval says in words, and where the connection it needs opens; both are optional, so a row stored without a payload (the text lives in the record's summary) still draws. */
export interface ApprovalDecisionPayload {
    /** The words of the request; the record's summary stands in when empty. */
    readonly text?: string | undefined
    /** Where the owner connects what the agent needs, when it needs a connection to go on. */
    readonly connectionHref?: string | undefined
}

/** A request for a decision of the engine: the words, then Approve and Refuse wired to the decision. Not edited in place. */
export const approvalDecisionKind: AgentMessageKind<z.ZodType<ApprovalDecisionPayload>> = defineAgentMessageKind({
    id: "approval.decision",
    payload: z.object({ text: z.string().max(4000).optional(), connectionHref: z.string().max(500).optional() }),
    actions: { approve: true, edit: "none", reject: true },
})

/** The report of a finished run: its words in the record's summary, the run it opens as the work. Read only. */
export const reportRunKind: AgentMessageKind<z.ZodType<ApprovalDecisionPayload>> = defineAgentMessageKind({
    id: "report.run",
    payload: z.object({ text: z.string().max(4000).optional(), connectionHref: z.string().max(500).optional() }),
    actions: { approve: false, edit: "none", reject: false },
})

/** Who handles a suggested way on: the workflow runs it again, or a person does it. */
export const STOPPED_HANDLERS = ["workflow", "person"] as const

/** The decisions a stopped workflow offers when the AI itself failed: the three freeze decisions. */
export const STOPPED_DECISIONS = ["retry", "take_over", "skip"] as const

const stoppedText = z.string().max(4000)

/** One suggested way on, from the AI, and who would do it. */
export interface StoppedSuggestion {
    readonly text: string
    readonly handledBy: (typeof STOPPED_HANDLERS)[number]
}

/** What a `workflow.stopped` message carries: where the workflow stopped, why, what the engine knows for sure, and the ways on. */
export interface WorkflowStoppedPayload {
    readonly workflow: { readonly moduleKey: string; readonly key: string; readonly title: string }
    readonly step: { readonly key: string; readonly nodeId: string; readonly title: string }
    readonly runId: string
    readonly leadId: string | null
    readonly conversationId: string | null
    /** `ai`: the AI core worded it; `engine`: the AI itself failed and the engine's static words stand in. */
    readonly by: "ai" | "engine"
    readonly reason: string
    readonly question: string | null
    /** True values the engine attached; never worded by a model. */
    readonly facts: ReadonlyArray<{ readonly name: string; readonly value: string }>
    /** 2 to 3 from the AI; none when the engine speaks. */
    readonly suggestions: ReadonlyArray<StoppedSuggestion>
    /** The freeze decisions, only when the AI itself failed. */
    readonly decisions: ReadonlyArray<(typeof STOPPED_DECISIONS)[number]>
    /** How many times this same step of this run stopped. */
    readonly repeats: number
    readonly firstAt: string
    readonly lastAt: string
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
    facts: z.array(z.object({ name: z.string().max(80), value: z.string().max(400) })).max(40),
    suggestions: z.array(z.object({ text: z.string().min(1).max(300), handledBy: z.enum(STOPPED_HANDLERS) })).max(3),
    decisions: z.array(z.enum(STOPPED_DECISIONS)).max(3),
    repeats: z.number().int().min(1),
    firstAt: z.string().max(40),
    lastAt: z.string().max(40),
})

/** The common team message of a stopped workflow, built by the engine only (never by a tool call). Read only: answers are replies and the freeze decisions. */
export const workflowStoppedKind: AgentMessageKind<z.ZodType<WorkflowStoppedPayload>> = defineAgentMessageKind({
    id: "workflow.stopped",
    payload: workflowStoppedPayload,
    actions: { approve: false, edit: "none", reject: false },
})

/** The kinds the core knows because they name no domain: a text, a table of rows, an approval and a run report. Media, invoices, payment requests and reports are registered by their modules. */
export const coreAgentMessageKinds: ReadonlyArray<AgentMessageKind> = [
    messageTextKind,
    recordsRowsKind,
    approvalDecisionKind,
    reportRunKind,
    workflowStoppedKind,
]

/** The kind with this id among the given ones, or none. */
export const agentMessageKindOf = (kinds: ReadonlyArray<AgentMessageKind>, id: string): AgentMessageKind | undefined =>
    kinds.find((kind) => kind.id === id)
