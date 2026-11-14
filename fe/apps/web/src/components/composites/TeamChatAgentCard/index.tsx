import { AgentMessageCard, agentMessageViews } from "@/modules/plugin-registry/client"
import { agentMessageItemOf, agentMessageKinds } from "@/modules/plugin-registry"
import { Badge, IconButton, Link, Stack } from "@starci/grammar/common"
import { ChatPartyMark } from "@/components/branches/ChatPartyMark"
import { ChatMessageFiles } from "@/components/leaves/ChatMessageFiles"
import { nivoIconSource } from "@/components/leaves/Icon"
import { bubbleReactionPropsOf } from "@/components/leaves/MessageReactionProps"
import { agentMessageWordsOf, chatMarkOf } from "@/modules/teamChat"
import type { MessageReactionActions, TeamChatMessageRow, TeamChatMessagesCopy } from "@/modules/types"

/** One line an agent said, as a card, and what may be done with it. */
interface TeamChatAgentCardProps extends MessageReactionActions {
    readonly row: TeamChatMessageRow
    readonly copy: TeamChatMessagesCopy
    /** The decision of this card is being answered. */
    readonly isDeciding: boolean
    readonly onPin: ((messageId: string, pinned: boolean) => void) | undefined
    readonly onDecide: (decisionId: string, verdict: "approved" | "refused") => void
}

/** The kinds whose view declares `workInHead` (a message about one record, such as an order): their way to the order stands in the head as a link, not as a button under the card. */
const hasWorkInHead = (kind: unknown): boolean =>
    agentMessageViews.some((view) => view.kind.id === kind && view.workInHead === true)

/** The way to the work of an order message, when the record carries one. */
interface OrderLink {
    readonly label: string
    readonly href: string
}

/** The link an order message carries to its order, or null for any other message or a record with no link. */
const orderLinkOf = (card: Readonly<Record<string, unknown>> | null): OrderLink | null => {
    if (card === null || !hasWorkInHead(card["kind"])) return null
    const work: unknown = card["work"]
    if (typeof work !== "object" || work === null) return null
    const label: unknown = Reflect.get(work, "label")
    const href: unknown = Reflect.get(work, "href")
    return typeof label === "string" && typeof href === "string" && href !== "" ? { label, href } : null
}

/**
 * What an agent says in the thread, drawn by the shared agent message card (envelope: which agent and when; kind and intent; the
 * content; the work it opens). An approval answers the one decision the desk and the team chat show; the pin sits at the end of the heading.
 */
export const TeamChatAgentCard = (props: TeamChatAgentCardProps) => {
    const { row, copy, onPin } = props
    const orderLink = orderLinkOf(row.card)
    const card = orderLink === null || row.card === null ? row.card : { ...row.card, work: undefined }
    const item = agentMessageItemOf(card, agentMessageKinds)
    if (item === null) return null
    const approval = row.approval
    const canDecide = approval?.canDecide === true
    const lifted = { bubble: { ...bubbleReactionPropsOf(row, copy.reactions, props), measure: "standard" } }
    return (
        <Stack gap="inline">
            <AgentMessageCard
                item={item}
                views={agentMessageViews}
                avatar={<ChatPartyMark size="sm" mark={chatMarkOf(row)} />}
                words={agentMessageWordsOf(copy)}
                maxLength={0}
                canApprove={canDecide}
                canReject={canDecide}
                canReply={false}
                isRunning={props.isDeciding}
                onApprove={() => approval !== null && props.onDecide(approval.decisionId, "approved")}
                onReject={() => approval !== null && props.onDecide(approval.decisionId, "refused")}
                onReply={() => undefined}
                {...lifted}
                {...(onPin === undefined && orderLink === null
                    ? {}
                    : {
                          trailing: (
                              <>
                                  {orderLink === null ? null : (
                                      <Link variant="head" href={orderLink.href}>
                                          {copy.orderOpen ?? orderLink.label}
                                      </Link>
                                  )}
                                  {onPin === undefined ? null : (
                                      <>
                                          {row.pinned ? <Badge tone="neutral">{copy.pinned}</Badge> : null}
                                          <IconButton
                                              intent="neutral"
                                              source={nivoIconSource("saved", "leading")}
                                              label={row.pinned ? copy.unpin : copy.pin}
                                              onPress={() => onPin(row.id, row.pinned)}
                                          />
                                      </>
                                  )}
                              </>
                          ),
                      })}
            />
            {row.files.length === 0 ? null : <ChatMessageFiles files={row.files} />}
        </Stack>
    )
}
