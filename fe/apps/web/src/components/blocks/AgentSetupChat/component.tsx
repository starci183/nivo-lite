import {
    Button,
    ChatBubble,
    ChatBubbleSkeletons,
    Pane,
    PaneGrid,
    Divider,
    EmptyNotice,
    FileDropzone,
    Form,
    Heading,
    Text,
    Textarea,
} from "@starci/grammar/common"
import { Fragment } from "react"
import type { ComponentProps } from "react"
import { SetupWriteCard } from "@/components/branches/SetupWriteCard"
import { BrandProposalView, type BrandProposalCommands } from "@/components/leaves/BrandProposalView"
import { SlotView } from "@/components/composites/SlotView"
import type {
    SetupWrite,
    SetupWriteDecision,
    DataSlot,
    SetupWriteInstance,
    SetupWriteWords,
    SlotLabels,
} from "@/modules/types"

import { CHAT_BAND, COMPOSER, COMPOSER_FIELD, COMPOSER_ROW, SENDING, THREAD, THREAD_BAND, WRITES } from "./classNames"

/** One message of the chat with the confirm cards that sit under it. */
export interface AgentSetupMessage {
    readonly id: string
    readonly isOwner: boolean
    readonly author: string
    readonly body: string
    readonly cards: ReadonlyArray<SetupWrite>
}

/** One revision of the chat: its messages and, when it was applied, the divider that closes it. */
export interface AgentSetupGroup {
    readonly id: string
    readonly messages: ReadonlyArray<AgentSetupMessage>
    readonly divider: string
}

/** What the chat draws once the setup is in. */
export interface AgentSetupChatContent {
    readonly chatTitle: string
    readonly chatPrivate: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly groups: ReadonlyArray<AgentSetupGroup>
    readonly instance: SetupWriteInstance | null
    readonly sendingLabel: string
    readonly isSending: boolean
    /** The last owner message waited past the timeout without a reply: the owner may write again. Empty when no turn was lost. */
    readonly staleLabel: string
    readonly composerLabel: string
    readonly text: string
    readonly sendLabel: string
    /** The words of the confirm cards under the replies. */
    readonly words: SetupWriteWords
    /** The card being settled now; empty when none. */
    readonly decidingId: string
    /** The brand guideline flow of the AI Marketing agent; null for the other agents. */
    readonly brand: AgentSetupBrand | null
}

/** The brand guideline flow of the chat: the PDF dropzone and the brand kits read from it. */
export interface AgentSetupBrand {
    readonly attachLabel: string
    readonly attachPrompt: string
    readonly isReading: boolean
    readonly readingLabel: string
    readonly cards: ReadonlyArray<ComponentProps<typeof BrandProposalView>["props"]>
}

/** The chat as a slot, the notice for anyone who may not set an agent up, and the commands. */
export interface AgentSetupChatBaseProps {
    readonly props: {
        readonly slot: DataSlot<AgentSetupChatContent>
        readonly placeholder: AgentSetupChatContent
        readonly slotLabels: SlotLabels
        /** The notice shown instead of the chat; empty when the person may set the agent up. */
        readonly forbidden: string
    }
    readonly on: {
        readonly text: (value: string) => void
        readonly send: () => void
        readonly decide: (id: string, change: SetupWriteDecision) => void
        readonly retry: () => void
        readonly attach: (files: ReadonlyArray<File>) => void
        readonly brandField: (name: Parameters<BrandProposalCommands["field"]>[0], value: string) => void
        readonly brandConfirm: (id: string) => void
        readonly brandToggleEdit: (id: string) => void
        readonly brandReject: (id: string) => void
    }
}

/** A chat with its commands. */
interface ChatPartProps {
    readonly content: AgentSetupChatContent
    readonly isSkeleton: boolean
    readonly on: AgentSetupChatBaseProps["on"]
}

const sendingOf = (content: AgentSetupChatContent) =>
    content.brand?.isReading === true ? content.brand.readingLabel : content.sendingLabel

/** The brand proposal cards with the commands that settle them. */
type BrandCardsProps = Pick<ChatPartProps, "content" | "on">

const BrandCards = (props: BrandCardsProps) => {
    const on: BrandProposalCommands = {
        field: props.on.brandField,
        confirm: props.on.brandConfirm,
        toggleEdit: props.on.brandToggleEdit,
        reject: props.on.brandReject,
    }
    return (
        <>
            {props.content.brand?.cards.map((card) => (
                <BrandProposalView key={card.id} props={card} on={on} />
            ))}
        </>
    )
}

const Conversation = (props: ChatPartProps) => (
    <div className={THREAD} aria-live="polite">
        {props.isSkeleton ? (
            <div className={THREAD_BAND}>
                <ChatBubbleSkeletons count={3} />
            </div>
        ) : null}
        {props.content.groups.every((group) => group.messages.length === 0) && !props.isSkeleton ? (
            <div className={THREAD_BAND}>
                <EmptyNotice message={props.content.emptyTitle} description={props.content.emptyBody} />
            </div>
        ) : null}
        {props.content.groups.map((group) => (
            <Fragment key={group.id}>
                {group.messages.length === 0 ? null : (
                    <div className={THREAD_BAND}>
                        {group.messages.map((message) => (
                            <ChatBubble
                                key={message.id}
                                side={message.isOwner ? "outgoing" : "incoming"}
                                author={message.author}
                                footer={
                                    message.cards.length > 0 ? (
                                        <div className={WRITES}>
                                            {message.cards.map((card) => (
                                                <SetupWriteCard
                                                    key={card.id}
                                                    write={card}
                                                    words={props.content.words}
                                                    isBusy={props.content.decidingId === card.id}
                                                    onDecide={props.on.decide}
                                                    instance={props.content.instance}
                                                />
                                            ))}
                                        </div>
                                    ) : undefined
                                }
                            >
                                {message.body}
                            </ChatBubble>
                        ))}
                    </div>
                )}
                {group.divider === "" ? null : <Divider label={group.divider} />}
            </Fragment>
        ))}
        {(props.content.brand?.cards.length ?? 0) > 0 ? (
            <div className={THREAD_BAND}>
                <BrandCards content={props.content} on={props.on} />
            </div>
        ) : null}
        {props.content.staleLabel === "" ? null : (
            <div className={SENDING}>
                <Text size="sm" tone="muted" live="polite">
                    {props.content.staleLabel}
                </Text>
            </div>
        )}
        {props.content.isSending || props.content.brand?.isReading === true ? (
            <div className={SENDING}>
                <Text size="sm" tone="muted" live="polite">
                    {sendingOf(props.content)}
                </Text>
            </div>
        ) : null}
    </div>
)

const Composer = (props: ChatPartProps) => (
    <Form
        label={props.content.chatTitle}
        onSubmit={(_, event) => {
            event.preventDefault()
            props.on.send()
        }}
    >
        <div className={COMPOSER}>
            <div className={COMPOSER_ROW}>
                <div className={COMPOSER_FIELD}>
                    <Textarea
                        id="setup-composer"
                        name="message"
                        label={props.content.composerLabel}
                        isLabelHidden
                        placeholder={props.content.composerLabel}
                        rows={2}
                        maxLength={4000}
                        value={props.content.text}
                        isSkeleton={props.isSkeleton}
                        isDisabled={props.content.isSending}
                        onValueChange={props.on.text}
                        onSubmitShortcut={props.on.send}
                    />
                </div>
                <Button
                    intent="commit"
                    isPending={props.content.isSending}
                    isDisabled={props.isSkeleton || props.content.text.trim().length === 0}
                    onPress={props.on.send}
                >
                    {props.content.sendLabel}
                </Button>
            </div>
            {props.content.brand === null ? null : (
                <FileDropzone
                    label={props.content.brand.attachLabel}
                    accept=".pdf,application/pdf"
                    prompt={props.content.brand.attachPrompt}
                    isDisabled={props.isSkeleton || props.content.brand.isReading}
                    hideFileList
                    onFilesChange={props.on.attach}
                />
            )}
        </div>
    </Form>
)

const Chat = (props: ChatPartProps) => (
    <PaneGrid
        label={props.content.chatTitle}
        areas={["head", "conversation", "composer"]}
        rows={["auto", "fill", "auto"]}
    >
        <Pane area="head" surface>
            <div className={CHAT_BAND}>
                <Heading level={2}>{props.content.chatTitle}</Heading>
                <Text size="xs" tone="muted">
                    {props.content.chatPrivate}
                </Text>
            </div>
        </Pane>
        <Pane area="conversation" surface scroll label={props.content.chatTitle}>
            <Conversation {...props} />
        </Pane>
        <Pane area="composer" surface>
            <Composer {...props} />
        </Pane>
    </PaneGrid>
)

/** Draws the private chat with NIVO: the messages with their confirm cards, and the composer. */
export const AgentSetupChatBase = (props: AgentSetupChatBaseProps) =>
    props.props.forbidden === "" ? (
        <SlotView
            slot={props.props.slot}
            placeholder={props.props.placeholder}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
        >
            {(content, isSkeleton) => <Chat content={content} isSkeleton={isSkeleton} on={props.on} />}
        </SlotView>
    ) : (
        <EmptyNotice message={props.props.forbidden} />
    )
