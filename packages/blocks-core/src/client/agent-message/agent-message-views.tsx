import { useState } from "react"
import type { z } from "zod"
import type { ReactNode } from "react"
import { Button, Cluster, Form, Quote, Stack, Text, Textarea } from "@starci/grammar/common"
import type { AgentMessageRecord } from "../../agent-message/agent-message-item"
import {
    approvalDecisionKind,
    messageTextKind,
    recordsRowsKind,
    reportRunKind,
    workflowStoppedKind,
} from "../../agent-message/agent-message-kinds"
import type { AgentMessageKind, ApprovalDecisionPayload } from "../../agent-message/agent-message-kinds"
import { keyedRows } from "../../agent-message/agent-message-rows"
import type { AgentMessageWords } from "./agent-message-words"

/** What a view is given besides the payload: the message it belongs to and the words of the viewer's language. */
export interface AgentMessageViewContext {
    /** The message the payload belongs to. */
    readonly record: AgentMessageRecord
    /** The words of the card. */
    readonly words: AgentMessageWords
}

/** What the editor of a payload is given: the payload, its words, and the two ways out. */
export interface AgentMessageEditorProps {
    /** The payload as the proposal holds it. */
    readonly payload: unknown
    /** The label of the field, already in the viewer's words. */
    readonly label: string
    /** The words of the button that approves the changed payload. */
    readonly submitLabel: string
    /** The words of the button that leaves the editor. */
    readonly cancelLabel: string
    /** How long an edited text may be. */
    readonly maxLength: number
    /** The approval is in flight. */
    readonly isPending: boolean
    /** Approves with the changed values; the action receives them as `values`. */
    readonly onSubmit: (values: Readonly<Record<string, string>>) => void
    /** Leaves the editor with nothing changed. */
    readonly onCancel: () => void
}

/**
 * How one kind of payload looks and, where editing makes sense, how it is changed in place. A client registers one per kind id; the shell
 * of the approval card draws whatever is registered and falls back to a summary line for a kind with no view.
 */
export interface AgentMessageView {
    /** The kind this view draws. */
    readonly kind: AgentMessageKind
    /** The payload as a person reads it before approving. */
    readonly preview: (payload: unknown, context: AgentMessageViewContext) => ReactNode
    /** Where the owner connects what the agent needs to go on, when the payload says so; none otherwise. */
    readonly connectionHref?: (payload: unknown) => string
    /** The editor of a kind whose edit mode is `inline`. */
    readonly editor?: (props: AgentMessageEditorProps) => ReactNode
}

/** The view of a payload with a typed preview: it reads the payload through its kind's schema and draws nothing for one that does not fit. */
const textPreview = (payload: unknown): ReactNode => {
    const parsed = messageTextKind.payload.safeParse(payload)
    return parsed.success ? <Quote text={parsed.data.text} /> : null
}

/** The text in a field; the button approves the changed words, cancel leaves it as it was. */
const TextEditor = (props: AgentMessageEditorProps): ReactNode => {
    const parsed = messageTextKind.payload.safeParse(props.payload)
    const [text, setText] = useState(parsed.success ? parsed.data.text : "")
    return (
        <Form label={props.label} isPending={props.isPending} onSubmit={() => props.onSubmit({ text: text.trim() })}>
            <Textarea
                name="text"
                label={props.label}
                isLabelHidden
                rows={3}
                maxLength={props.maxLength}
                value={text}
                onValueChange={setText}
            />
            <Cluster gap="inline">
                <Button type="submit" intent="commit" isPending={props.isPending} isDisabled={text.trim() === ""}>
                    {props.submitLabel}
                </Button>
                <Button intent="neutral" onPress={props.onCancel}>
                    {props.cancelLabel}
                </Button>
            </Cluster>
        </Form>
    )
}

/** The rows to write: the column names, then one line per row. */
const rowsPreview = (payload: unknown): ReactNode => {
    const parsed = recordsRowsKind.payload.safeParse(payload)
    if (!parsed.success) return null
    const { columns, rows } = parsed.data
    return (
        <Stack gap="inline">
            {columns.length === 0 ? null : (
                <Text size="sm" tone="muted">
                    {columns.join(" · ")}
                </Text>
            )}
            {keyedRows(rows).map((row) => (
                <Text key={row.key} size="sm">
                    {row.cells.join(" · ")}
                </Text>
            ))}
        </Stack>
    )
}

/** The words of an approval or of a run report: the payload's text, else the summary the record carries (a row stored without a payload). */
const wordsPreview =
    (kind: AgentMessageKind<z.ZodType<ApprovalDecisionPayload>>) =>
    (payload: unknown, context: AgentMessageViewContext): ReactNode => {
        const parsed = kind.payload.safeParse(payload)
        const text = parsed.success ? (parsed.data.text ?? "") : ""
        const words = text === "" ? context.record.summary : text
        return words === "" ? null : <Text size="sm">{words}</Text>
    }

/** The stopped workflow: the reason, the question, then the engine's true facts as name and value lines. The suggestions are the card's reply buttons. */
const stoppedPreview = (payload: unknown): ReactNode => {
    const parsed = workflowStoppedKind.payload.safeParse(payload)
    if (!parsed.success) return null
    const { reason, question, facts } = parsed.data
    return (
        <Stack gap="inline">
            <Text size="sm">{reason}</Text>
            {question === null ? null : <Text size="sm">{question}</Text>}
            {facts.map((fact, index) => (
                <Text key={`${fact.name}-${String(index)}`} size="sm" tone="muted">
                    {fact.name}: {fact.value}
                </Text>
            ))}
        </Stack>
    )
}

/** Where the connection the approval needs opens; none when the payload names none. */
const connectionOf = (payload: unknown): string => {
    const parsed = approvalDecisionKind.payload.safeParse(payload)
    return parsed.success ? (parsed.data.connectionHref ?? "") : ""
}

/** The views of the kinds the core knows. A module adds the views of its own kinds from its own folder. */
export const coreAgentMessageViews: ReadonlyArray<AgentMessageView> = [
    { kind: messageTextKind, preview: textPreview, editor: TextEditor },
    { kind: recordsRowsKind, preview: rowsPreview },
    { kind: approvalDecisionKind, preview: wordsPreview(approvalDecisionKind), connectionHref: connectionOf },
    { kind: reportRunKind, preview: wordsPreview(reportRunKind) },
    { kind: workflowStoppedKind, preview: stoppedPreview },
]

/** Declares the view of a kind: how its payload reads and, where the kind allows it, how it is edited in place. */
export const defineAgentMessageView = (view: AgentMessageView): AgentMessageView => view
