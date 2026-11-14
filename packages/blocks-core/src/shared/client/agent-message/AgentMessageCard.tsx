import { useState, type ReactNode } from "react"
import { Avatar, Cluster, MessageCard, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { AgentMessageItem, AgentMessageRecord } from "../../agent-message/agent-message-item"
import { actionsOf, repliesOf } from "./AgentMessageActions"
import { HeadChip, Summary, WhyList, metaOf, outboundOf } from "./AgentMessageParts"
import type { AgentMessageView } from "./agent-message-views"
import type { AgentMessageEdits, AgentMessageWords } from "./agent-message-words"

export type { AgentMessageEdits, AgentMessageKindWords, AgentMessageWords } from "./agent-message-words"

/** What the card is given: the message, how its kinds are drawn, the words, and what a person may do. */
export interface AgentMessageCardProps {
    readonly item: AgentMessageItem
    readonly views: ReadonlyArray<AgentMessageView>
    readonly words: AgentMessageWords
    readonly maxLength: number
    /** The viewer may approve. */
    readonly canApprove: boolean
    /** The viewer may reject. */
    readonly canReject: boolean
    /** The viewer may answer an ask. */
    readonly canReply: boolean
    /** A verdict or an answer is in flight. */
    readonly isRunning: boolean
    /** Approves, with the edited values when the payload was changed in place. */
    readonly onApprove: (values: AgentMessageEdits | null) => void
    readonly onReject: () => void
    /** Answers an ask with one of its options. */
    readonly onReply: (optionId: string) => void
    /** Controls of the host at the end of the head (the pin of a conversation, for example). */
    readonly trailing?: ReactNode
    /**
     * What the host lifts to the card's bubble, as `MessageCard` takes it: `reactions`, `onReact`, `onReply`, `onShare`,
     * `reactionLabels` and `groupPosition`. Passed through untouched; absent, the card has no emoji toolbar.
     */
    readonly bubble?: Readonly<Record<string, unknown>>
    /** The mark of the agent beside the card, as the host draws its bubbles; absent, the card draws the initials avatar of the agent. */
    readonly avatar?: ReactNode
}

/** What draws the payload: the view of its kind (or none), and the state of the edit. */
interface PayloadParams {
    readonly record: AgentMessageRecord
    readonly payload: unknown
    readonly view: AgentMessageView | undefined
    readonly views: ReadonlyArray<AgentMessageView>
    readonly words: AgentMessageWords
    readonly maxLength: number
    readonly isRunning: boolean
    readonly isEditing: boolean
    readonly onApprove: (values: AgentMessageEdits) => void
    readonly onClose: () => void
}

/** The summary of a record whose kind has no view. */
const summaryOf = (record: PayloadParams["record"], openDetail: PayloadParams["words"]["openDetail"]): ReactNode => (
    <Summary record={record} openDetail={openDetail} />
)

/** The payload as its kind draws it: the editor while it is edited in place, else the preview, else the summary for an unknown kind. */
const PayloadView = (params: PayloadParams): ReactNode => {
    const { view } = params
    if (view === undefined) return summaryOf(params.record, params.words.openDetail)
    const editor = params.isEditing ? view.editor : undefined
    if (editor === undefined) {
        return view.preview(params.payload, { record: params.record, words: params.words, views: params.views })
    }
    return editor({
        payload: params.payload,
        label: params.words.editLabel,
        submitLabel: params.words.sendEdited,
        cancelLabel: params.words.cancel,
        maxLength: params.maxLength,
        isPending: params.isRunning,
        onSubmit: (values) => {
            params.onApprove(values)
            params.onClose()
        },
        onCancel: params.onClose,
    })
}

/**
 * One message from an agent, the same in the conversation, on the desk and in the inbox, drawn through Grammar `MessageCard`: the
 * agent's avatar at the start and a card at the bubble measure (never the full width) that holds, in this order, the head (the title and
 * the chip of its intent or state), the content as its kind draws it, full width with no tinted box around it (with, for a customer,
 * the channel and recipient, why a person is asked, and the answers of an ask as the
 * Grammar suggestions list: one bordered list, a pressable plain-text row per answer), the actions row (the
 * primary action, the secondary, a spacer, then where it leads, with the arrow last) and the meta line (which agent, when). It holds no
 * business and no domain word: kinds, copy and verdicts come in.
 */
export const AgentMessageCard = (props: AgentMessageCardProps): ReactNode => {
    const [isEditing, setIsEditing] = useState(false)
    const { record, state } = props.item
    const view = props.views.find((entry) => entry.kind.id === props.item.kind?.id)
    const outbound = outboundOf(record, props.words)
    const meta = metaOf(record)
    const replies = isEditing ? [] : repliesOf({ item: props.item, canReply: props.canReply })
    const body = (
        <Stack gap="row">
            <PayloadView
                record={record}
                payload={props.item.payload}
                view={view}
                views={props.views}
                words={props.words}
                maxLength={props.maxLength}
                isRunning={props.isRunning}
                isEditing={isEditing}
                onApprove={props.onApprove}
                onClose={() => setIsEditing(false)}
            />
            {outbound === "" ? null : <Text size="sm">{outbound}</Text>}
            <WhyList record={record} words={props.words} />
            {replies.length === 0 ? null : (
                <SurfaceCard
                    kind="list"
                    layout="suggestions"
                    ariaLabel={record.title}
                    empty={null}
                    items={replies.map((reply) => ({
                        id: reply.id,
                        title: reply.label,
                        onPress: () => props.onReply(reply.id),
                    }))}
                />
            )}
            {record.note === "" ? null : (
                <Text size="sm" tone="muted">
                    {record.note}
                </Text>
            )}
        </Stack>
    )
    return (
        <MessageCard
            measure="wide"
            {...props.bubble}
            avatar={props.avatar ?? <Avatar name={record.agent === "" ? record.title : record.agent} kind="agent" size="sm" isDecorative />}
            title={record.title}
            chip={
                <Cluster gap="inline">
                    <HeadChip intent={props.item.intent} state={state} words={props.words} />
                    {props.trailing}
                </Cluster>
            }
            body={body}
            actions={
                isEditing
                    ? []
                    : actionsOf({
                          item: props.item,
                          words: props.words,
                          connectionHref: view?.connectionHref?.(props.item.payload) ?? "",
                          canApprove: props.canApprove,
                          canReject: props.canReject,
                          canReply: props.canReply,
                          isRunning: props.isRunning,
                          onApprove: () => props.onApprove(null),
                          onEdit: () => setIsEditing(true),
                          onReject: props.onReject,
                          onReply: props.onReply,
                      })
            }
            meta={meta}
        />
    )
}
