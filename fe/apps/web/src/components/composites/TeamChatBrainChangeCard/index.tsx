import { Badge, MessageCard, Stack, SurfaceCard, Text, type MessageCardAction } from "@starci/grammar/common"
import { ChatPartyMark } from "@/components/branches/ChatPartyMark"
import { bubbleReactionPropsOf } from "@/components/leaves/MessageReactionProps"
import type {
    MessageReactionActions,
    TeamChatBrainChangeHandlers,
    TeamChatBrainChangeRowView,
    TeamChatBrainChangeView,
    TeamChatMessageRow,
    TeamChatMessagesCopy,
} from "@/modules/types"

/** One truth-change card of the thread and what may be done with it. */
interface TeamChatBrainChangeCardProps extends MessageReactionActions {
    readonly row: TeamChatMessageRow
    readonly card: TeamChatBrainChangeView
    readonly copy: TeamChatMessagesCopy
    /** What is done with the card; a thread that has none draws it without buttons. */
    readonly changes: TeamChatBrainChangeHandlers | undefined
}

/** The value of a list row: the value (struck when the new one replaces it, strong when it is the proposal) and its muted source line. */
const rowValueOf = (row: TeamChatBrainChangeRowView) => (
    <Stack gap="identity">
        <Text isSuperseded={row.isReplaced} isStrong={row.id === "proposed"}>
            {row.value}
        </Text>
        {row.note === null || row.note === "" ? null : (
            <Text size="xs" tone="muted">
                {row.note}
            </Text>
        )}
    </Stack>
)

/** The buttons the viewer may press, as the actions of the card: the one primary (Agree) first, then the neutral ones. */
const actionsOf = (card: TeamChatBrainChangeView, changes: TeamChatBrainChangeHandlers | undefined): ReadonlyArray<MessageCardAction> =>
    changes === undefined
        ? []
        : card.buttons.map((button) => ({
              id: button.action,
              label: button.label,
              kind: button.kind,
              isPending: changes.pendingId === card.changeId,
              onPress: () => changes.onAction(card.changeId, button.action),
          }))

/**
 * The typed `brain.change` card: an agent proposes to change, add or remove a truth of the Second Brain. Flat white (Grammar
 * `MessageCard`), the title with its state chip (no dot), the key of the truth, then the bordered list of the value now and the value
 * proposed (surface in surface), the reason, the quotes it rests on, and exactly the buttons the viewer may press: Agree is the card's
 * one red, No and Keep both are neutral. Once decided the card is rewritten in place to "key: old → new" and a trace row.
 */
export const TeamChatBrainChangeCard = (props: TeamChatBrainChangeCardProps) => {
    const { card, row, changes } = props
    return (
        <MessageCard
            title={card.title}
            chip={<Badge tone={card.chip.tone}>{card.chip.label}</Badge>}
            actions={actionsOf(card, changes)}
            avatar={<ChatPartyMark size="sm" mark={card.mark} />}
            author={row.authorName}
            meta={card.meta}
            measure="wide"
            {...bubbleReactionPropsOf(row, props.copy.reactions, props)}
            body={
                <Stack gap="row">
                    <Text>{card.keyLine}</Text>
                    {card.rows.length === 0 ? null : (
                        <SurfaceCard
                            kind="list"
                            layout="keyValue"
                            ariaLabel={card.rowsLabel}
                            empty={null}
                            items={card.rows.map((line) => ({ id: line.id, title: line.name, value: rowValueOf(line) }))}
                        />
                    )}
                    {card.reason === null ? null : (
                        <Text>
                            <Text as="span" tone="muted">
                                {card.reason.label}
                            </Text>{" "}
                            {card.reason.text}
                        </Text>
                    )}
                    {card.quotes.length === 0 ? null : (
                        <SurfaceCard
                            kind="list"
                            ariaLabel={card.quotesLabel}
                            empty={null}
                            items={card.quotes.map((quote) => ({
                                id: quote.id,
                                title: quote.quote,
                                description: (
                                    <Text as="span" size="xs" tone="muted">
                                        {quote.line}
                                    </Text>
                                ),
                            }))}
                        />
                    )}
                    {card.trace === null ? null : (
                        <SurfaceCard
                            kind="list"
                            ariaLabel={card.traceLabel}
                            empty={null}
                            items={[
                                {
                                    id: "trace",
                                    title: card.trace.title,
                                    description: (
                                        <Text as="span" size="xs" tone="muted">
                                            {card.trace.line}
                                        </Text>
                                    ),
                                },
                            ]}
                        />
                    )}
                    {card.note === null ? null : (
                        <Text size="xs" tone="muted">
                            {card.note}
                        </Text>
                    )}
                </Stack>
            }
        />
    )
}
