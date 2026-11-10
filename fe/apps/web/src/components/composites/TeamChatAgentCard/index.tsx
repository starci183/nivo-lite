import { AgentMessageCard, agentMessageViews } from "@nivo-lite/blocks-core/client"
import type { AgentMessageWords } from "@nivo-lite/blocks-core/client"
import { agentMessageItemOf, agentMessageKinds } from "@nivo-lite/blocks-core"
import { Badge, IconButton, Link, Stack } from "@starci/grammar/common"
import { ChatPartyMark } from "@/components/branches/ChatPartyMark"
import { ChatMessageFiles } from "@/components/leaves/ChatMessageFiles"
import { nivoIconSource } from "@/components/leaves/Icon"
import { bubbleReactionPropsOf } from "@/components/leaves/MessageReactionProps"
import { chatMarkOf } from "@/modules/teamChat"
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

/** The shared words of the message card, from the words of the thread. */
const wordsOf = (copy: TeamChatMessagesCopy): AgentMessageWords => ({
    approve: copy.approve,
    edit: "",
    reject: copy.refuse,
    sendEdited: "",
    cancel: "",
    why: "",
    evidence: "",
    rule: "",
    openDetail: copy.relatedWork,
    openWork: "",
    from: copy.agentFrom,
    to: "",
    via: "",
    outboundTo: "",
    editLabel: "",
    states: {
        waiting: copy.approvalPending,
        approved: copy.approvalApproved,
        sent: copy.approvalApproved,
        rejected: copy.approvalRefused,
        failed: copy.approvalRefused,
        expired: copy.approvalExpired,
    },
    intents: { notify: copy.intentNotify, report: copy.report },
    kinds: {
        total: copy.orderTotal,
        customer: copy.orderCustomer,
        deliver: copy.orderDeliver,
        openConnections: copy.openConnections,
    },
})

/** The kinds of a message that is about an order: their way to the order stands in the head as a link, not as a button under the card. */
const ORDER_KINDS: ReadonlySet<string> = new Set(["order.summary", "payment.received"])

/** The way to the work of an order message, when the record carries one. */
interface OrderLink {
    readonly label: string
    readonly href: string
}

/** The link an order message carries to its order, or null for any other message or a record with no link. */
const orderLinkOf = (card: Readonly<Record<string, unknown>> | null): OrderLink | null => {
    if (card === null || !ORDER_KINDS.has(String(card["kind"]))) return null
    const work: unknown = card["work"]
    if (typeof work !== "object" || work === null) return null
    const label: unknown = Reflect.get(work, "label")
    const href: unknown = Reflect.get(work, "href")
    return typeof label === "string" && typeof href === "string" && href !== "" ? { label, href } : null
}

/**
 * What an agent says in the thread, drawn by the shared agent message card (envelope: which agent and when; kind and intent; the
 * content; the work it opens). An approval answers the one decision the desk and the inbox show; the pin sits at the end of the heading.
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
                words={wordsOf(copy)}
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
