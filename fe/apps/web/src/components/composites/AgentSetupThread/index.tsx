import { ChatBubble, ChatBubbleSkeletons, Divider, EmptyNotice, Text } from "@starci/grammar/common"
import { Fragment, type ComponentProps, type ReactNode } from "react"
import { SetupWriteCard } from "@/components/branches/SetupWriteCard"
import { SetupProposals } from "@/components/leaves/SetupProposals"
import { BrandProposalView, type BrandProposalCommands } from "@/components/leaves/BrandProposalView"
import type { SetupWrite, SetupWriteDecision, SetupWriteInstance, SetupWriteWords } from "@/modules/types"

/** One message of the chat with the confirm cards that sit under it. */
interface AgentSetupMessage {
    readonly id: string
    readonly isOwner: boolean
    readonly author: string
    readonly body: string
    readonly cards: ReadonlyArray<SetupWrite>
}

/** One revision of the chat: its messages and, when it was applied, the divider that closes it. */
interface AgentSetupGroup {
    readonly id: string
    readonly messages: ReadonlyArray<AgentSetupMessage>
    readonly divider: string
}

/** The brand kits read from the guideline PDF, and the line shown while one is being read. */
interface AgentSetupBrandKits {
    readonly isReading: boolean
    readonly readingLabel: string
    readonly cards: ReadonlyArray<ComponentProps<typeof BrandProposalView>["props"]>
}

/** One gate NIVO filled and the owner has not confirmed yet, as the chat proposes it ("Item 4 · ..."). */
interface AgentSetupProposal {
    readonly key: string
    readonly title: string
    readonly evidence: string
}

/** What the thread draws: the conversation, the confirm cards under the replies and the lines about a turn in flight. */
export interface AgentSetupThreadContent {
    readonly emptyTitle: string
    readonly emptyBody: string
    /** The chat holds at least one message. */
    readonly hasMessages: boolean
    readonly groups: ReadonlyArray<AgentSetupGroup>
    readonly instance: SetupWriteInstance | null
    readonly sendingLabel: string
    readonly isSending: boolean
    /** The last owner message waited past the timeout without a reply: the owner may write again. Empty when no turn was lost. */
    readonly staleLabel: string
    /** The words of the confirm cards under the replies. */
    readonly words: SetupWriteWords
    /** The card being settled now; empty when none. */
    readonly decidingId: string
    /** The gates NIVO proposed, drawn under its latest reply. */
    readonly proposals: ReadonlyArray<AgentSetupProposal>
    /** The brand kits of the AI Marketing agent; null for the other agents. */
    readonly brandKits: AgentSetupBrandKits | null
}

/** The words of the proposals under NIVO's latest reply. */
interface AgentSetupThreadCopy {
    readonly proposalsLabel: string
    readonly confirmLabel: string
    readonly proposalEditLabel: string
}

/** What the thread can do: settle a card, confirm or edit a proposed item, and the brand kit commands. */
interface AgentSetupThreadCommands {
    readonly decide: (id: string, change: SetupWriteDecision) => void
    readonly gate: (gateKey: string, action: "confirm") => void
    readonly startEdit: (gateKey: string, evidence: string) => void
    readonly brandField: (name: Parameters<BrandProposalCommands["field"]>[0], value: string) => void
    readonly brandConfirm: (id: string) => void
    readonly brandToggleEdit: (id: string) => void
    readonly brandReject: (id: string) => void
}

/** Content, copy and commands of the thread. */
interface AgentSetupThreadProps {
    readonly content: AgentSetupThreadContent
    readonly isSkeleton: boolean
    readonly copy: AgentSetupThreadCopy
    readonly on: AgentSetupThreadCommands
}

/** The id of the newest reply of NIVO, under which the proposals stand; empty before NIVO answered. */
const latestReplyOf = (groups: ReadonlyArray<AgentSetupGroup>): string =>
    groups.flatMap((group) => group.messages).findLast((message) => !message.isOwner)?.id ?? ""

/** The thread with one of its messages, and whether that message is the newest reply of NIVO. */
interface FooterInput extends AgentSetupThreadProps {
    readonly message: AgentSetupMessage
    readonly isLatestReply: boolean
}

/** The footer of one bubble: the confirm cards of its writes and, under the newest reply, the proposed items; none without either. */
const bubbleFooterOf = (props: FooterInput): ReactNode => {
    const hasProposals = props.isLatestReply && props.content.proposals.length > 0
    if (props.message.cards.length === 0 && !hasProposals) return undefined
    return (
        <>
            {props.message.cards.map((card) => (
                <SetupWriteCard
                    key={card.id}
                    write={card}
                    words={props.content.words}
                    isBusy={props.content.decidingId === card.id}
                    onDecide={props.on.decide}
                    instance={props.content.instance}
                />
            ))}
            {hasProposals ? (
                <SetupProposals
                    proposals={props.content.proposals}
                    label={props.copy.proposalsLabel}
                    confirmLabel={props.copy.confirmLabel}
                    editLabel={props.copy.proposalEditLabel}
                    onConfirm={(key) => props.on.gate(key, "confirm")}
                    onEdit={props.on.startEdit}
                />
            ) : null}
        </>
    )
}

/** The lines under the bubbles: a turn that was lost, and the reading of a brand PDF or the sending of a message. */
interface StatusProps {
    readonly content: AgentSetupThreadContent
}

const Status = (props: StatusProps) => {
    const reading = props.content.brandKits?.isReading === true ? props.content.brandKits.readingLabel : ""
    const live = reading === "" ? props.content.sendingLabel : reading
    return (
        <>
            {props.content.staleLabel === "" ? null : (
                <Text size="sm" tone="muted" live="polite">
                    {props.content.staleLabel}
                </Text>
            )}
            {props.content.isSending || reading !== "" ? (
                <Text size="sm" tone="muted" live="polite">
                    {live}
                </Text>
            ) : null}
        </>
    )
}

/** The conversation: the bubbles by revision (an applied revision closes with its divider), the brand kits and the live line. */
export const AgentSetupThread = (props: AgentSetupThreadProps) => {
    const latest = latestReplyOf(props.content.groups)
    const brandOn: BrandProposalCommands = {
        field: props.on.brandField,
        confirm: props.on.brandConfirm,
        toggleEdit: props.on.brandToggleEdit,
        reject: props.on.brandReject,
    }
    return (
        <>
            {props.isSkeleton ? <ChatBubbleSkeletons count={3} /> : null}
            {props.content.hasMessages || props.isSkeleton ? null : (
                <EmptyNotice message={props.content.emptyTitle} description={props.content.emptyBody} />
            )}
            {props.content.groups.map((group) => (
                <Fragment key={group.id}>
                    {group.messages.map((message) => (
                        <ChatBubble
                            key={message.id}
                            side={message.isOwner ? "outgoing" : "incoming"}
                            author={message.author}
                            footer={bubbleFooterOf({ ...props, message, isLatestReply: message.id === latest })}
                        >
                            {message.body}
                        </ChatBubble>
                    ))}
                    {group.divider === "" ? null : <Divider label={group.divider} />}
                </Fragment>
            ))}
            {props.content.brandKits?.cards.map((card) => (
                <BrandProposalView key={card.id} props={card} on={brandOn} />
            ))}
            <Status content={props.content} />
        </>
    )
}
