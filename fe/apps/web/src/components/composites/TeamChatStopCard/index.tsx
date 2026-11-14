import { Badge, Disclosure, Divider, MessageCard, Stack, Text } from "@starci/grammar/common"
import { ChatPartyMark } from "@/components/branches/ChatPartyMark"
import { bubbleReactionPropsOf } from "@/components/leaves/MessageReactionProps"
import type {
    MessageReactionActions,
    TeamChatMessageRow,
    TeamChatMessagesCopy,
    TeamChatStopCardView,
    TeamChatStopHandlers,
} from "@/modules/types"
import { approvalCardIdOf } from "@/hooks/teamChat"
import { StopAnswerBox, StopApproval, StopDecisionsRow, StopHandBack, type StopAnswerBoxProps } from "./controls"
import { StopLinesList, StopTraceList } from "./lists"

/** One stop card of the thread and what may be done with it. */
interface TeamChatStopCardProps extends MessageReactionActions {
    readonly row: TeamChatMessageRow
    readonly card: TeamChatStopCardView
    readonly copy: TeamChatMessagesCopy
    /** What is done with the card; a thread that has none draws it without controls. */
    readonly stops: TeamChatStopHandlers | undefined
}

/**
 * The typed `workflow.stopped` card of a run, one per stop, rewritten in place: the agent and the muted line of the workflow, step and
 * time above it; inside, the headline with its state chip, the message and the question, then only the controls `needs` allows (the
 * answer box with its suggestions and the one red Send; the neutral decisions; the approval with the whole message and Approve and Refuse; after a take-over the hand-back button), the trace of
 * the replies and, folded and closed, the raw facts under "Technical details". Between the question and the suggestions: the bordered
 * list of the worded facts, then the preview a package drew (nothing when there is none). Every list inside is a bordered list.
 */
export const TeamChatStopCard = (props: TeamChatStopCardProps) => {
    const { card, row, stops } = props
    const controls: StopAnswerBoxProps | null =
        stops === undefined
            ? null
            : { card, isPending: stops.pendingKey === card.key, act: (action) => stops.onAction(card, action) }
    return (
        <MessageCard
            measure="wide"
            {...(card.approval === null ? {} : { id: approvalCardIdOf(card.approval.workItemId) })}
            author={row.authorName}
            meta={card.meta}
            avatar={<ChatPartyMark size="sm" mark={card.mark} />}
            title={card.headline}
            chip={<Badge tone={card.chip.tone}>{card.chip.label}</Badge>}
            {...bubbleReactionPropsOf(row, props.copy.reactions, props)}
            body={
                <Stack gap="row">
                    {card.message === "" ? null : <Text>{card.message}</Text>}
                    {card.question === null || card.question === "" ? null : <Text isStrong>{card.question}</Text>}
                    {card.facts.length === 0 ? null : <StopLinesList label={card.labels.factsLabel} lines={card.facts} />}
                    {card.preview}
                    {card.approval === null ? null : (
                        <StopApproval card={card} lines={card.approval.lines} controls={controls} isOwner={stops?.isOwner === true} />
                    )}
                    {card.replies.length === 0 ? null : <StopTraceList card={card} />}
                    {controls !== null && card.canAnswer ? <StopAnswerBox {...controls} /> : null}
                    {controls !== null && card.heldConversationId !== null ? (
                        <StopHandBack {...controls} conversationId={card.heldConversationId} />
                    ) : null}
                    {controls !== null && card.decisions.length > 0 ? (
                        <>
                            <Divider semantics="presentation" />
                            <StopDecisionsRow {...controls} />
                        </>
                    ) : null}
                    {card.technical.length === 0 ? null : (
                        <Disclosure
                            kind="quiet"
                            title={card.labels.details}
                            body={<StopLinesList label={card.labels.details} lines={card.technical} />}
                        />
                    )}
                </Stack>
            }
        />
    )
}
