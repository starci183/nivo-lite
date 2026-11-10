import { useState } from "react"
import { Badge, Divider, MessageCard, Stack, Text, TextAction } from "@starci/grammar/common"
import { ChatPartyMark } from "@/components/branches/ChatPartyMark"
import { bubbleReactionPropsOf } from "@/components/leaves/MessageReactionProps"
import type {
    MessageReactionActions,
    TeamChatMessageRow,
    TeamChatMessagesCopy,
    TeamChatStopCardView,
    TeamChatStopHandlers,
} from "@/modules/types"
import { StopAnswerBox, StopApproval, StopDecisionsRow, type StopAnswerBoxProps } from "./controls"
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
 * answer box with its suggestions and the one red Send; the neutral decisions with "Details" at the row end; the approval lines with
 * Approve and Refuse), the trace of the replies and the folded facts. Every list inside is a bordered list (surface in surface).
 */
export const TeamChatStopCard = (props: TeamChatStopCardProps) => {
    const { card, row, stops } = props
    const [isFactsOpen, setIsFactsOpen] = useState(false)
    const controls: StopAnswerBoxProps | null =
        stops === undefined
            ? null
            : { card, isPending: stops.pendingKey === card.key, act: (action) => stops.onAction(card, action) }
    const details =
        card.facts.length === 0 ? null : (
            <TextAction appearance="plain" size="sm" onPress={() => setIsFactsOpen((isOpen) => !isOpen)}>
                {card.labels.details}
            </TextAction>
        )
    return (
        <MessageCard
            measure="wide"
            author={row.authorName}
            meta={card.meta}
            avatar={<ChatPartyMark size="sm" mark={card.mark} />}
            title={card.headline}
            chip={<Badge tone={card.chip.tone}>{card.chip.label}</Badge>}
            {...bubbleReactionPropsOf(row, props.copy.reactions, props)}
            body={
                <Stack gap="row">
                    {card.message === "" ? null : <Text>{card.message}</Text>}
                    {card.question === null || card.question === "" ? null : <Text>{card.question}</Text>}
                    {card.approval === null ? null : (
                        <StopApproval card={card} lines={card.approval.lines} controls={controls} isOwner={stops?.isOwner === true} />
                    )}
                    {card.replies.length === 0 ? null : <StopTraceList card={card} />}
                    {controls !== null && card.canAnswer ? <StopAnswerBox {...controls} /> : null}
                    {controls !== null && card.decisions.length > 0 ? (
                        <>
                            <Divider semantics="presentation" />
                            <StopDecisionsRow {...controls} details={details} />
                        </>
                    ) : (
                        details
                    )}
                    {isFactsOpen && card.facts.length > 0 ? <StopLinesList label={card.labels.factsLabel} lines={card.facts} /> : null}
                </Stack>
            }
        />
    )
}
