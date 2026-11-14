import type { ReactNode } from "react"
import { Disclosure, Stack, Text } from "@starci/grammar/common"
import type { AgentMessagePreview, ApprovalDecisionPayload } from "@nivo-lite/agent-sdk/team-chat"
import { approvalRowsOf, previewViewOf } from "../../agent-message/agent-message-approval"
import { FactRows } from "./AgentMessageFacts"
import type { AgentMessageViewContext } from "./agent-message-views"

/** The preview a package registered, drawn by the view of its kind; nothing when the kind is unknown or the payload does not fit it. */
interface PreviewOfProps {
    readonly preview: AgentMessagePreview | undefined
    readonly context: AgentMessageViewContext
}

/** The preview of a card (an approval or a stop): the package's own renderer for its kind, or nothing (the card still works). */
export const PreviewOf = (props: PreviewOfProps): ReactNode => {
    const found = previewViewOf(props.preview, props.context.views)
    return found === null ? null : found.view.preview(found.payload, props.context)
}

/** What the approval card draws between its head and its buttons. */
interface ApprovalDecisionBodyProps {
    readonly payload: ApprovalDecisionPayload
    /** The AI's brief (the record's summary when the payload has none). */
    readonly brief: string
    readonly context: AgentMessageViewContext
}

/**
 * The body of an approval: the AI's brief, ONE bordered list of what is asked (the step, the account, the amounts and the
 * arguments the engine worded from the real call), the preview a package drew for it, then the technical rows folded under their own
 * disclosure. The buttons are the card's actions, not part of the body. A row stored before the card (only words) draws just the brief.
 */
export const ApprovalDecisionBody = (props: ApprovalDecisionBodyProps): ReactNode => {
    const { words } = props.context
    const rows =
        words.approval === undefined ? { worded: [], technical: [] } : approvalRowsOf(props.payload, words.approval)
    const technicalLabel = words.facts?.technical ?? ""
    return (
        <Stack gap="row">
            {props.brief === "" ? null : <Text size="sm">{props.brief}</Text>}
            {rows.worded.length === 0 ? null : <FactRows label={props.context.record.title} facts={rows.worded} />}
            <PreviewOf preview={props.payload.preview} context={props.context} />
            {rows.technical.length === 0 || technicalLabel === "" ? null : (
                <Disclosure
                    kind="quiet"
                    title={technicalLabel}
                    body={<FactRows label={technicalLabel} facts={rows.technical} />}
                />
            )}
        </Stack>
    )
}
