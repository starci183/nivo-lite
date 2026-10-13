import {
    Button,
    ChatBubble,
    ChatBubbleSkeletons,
    ChatWorkspace,
    Divider,
    EmptyNotice,
    FillViewport,
    Form,
    Heading,
    Spinner,
    SurfaceCard,
    Text,
    Textarea,
} from "@starci/grammar/common"
import { Fragment } from "react"
import { SetupWriteCard } from "@/components/branches/SetupWriteCard"
import { SlotView } from "@/components/composites/SlotView"
import type { SetupWrite, WriteDecision } from "@/lib/module-setup-writes"
import type { DataSlot, SetupWriteInstance, SetupWriteWords, SlotLabels } from "@/modules/types"
import { CHAT_BAND, COMPOSER, COMPOSER_FIELD, COMPOSER_ROW, SENDING, THREAD, WRITES } from "./classNames"

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
    readonly composerLabel: string
    readonly text: string
    readonly sendLabel: string
    /** The words of the confirm cards under the replies. */
    readonly words: SetupWriteWords
    /** The card being settled now; empty when none. */
    readonly decidingId: string
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
        readonly decide: (id: string, change: WriteDecision) => void
        readonly retry: () => void
    }
}

/** A chat with its commands. */
interface ChatPartProps {
    readonly content: AgentSetupChatContent
    readonly isSkeleton: boolean
    readonly on: AgentSetupChatBaseProps["on"]
}

const Conversation = (props: ChatPartProps) => (
    <div className={THREAD} aria-live="polite">
        {props.isSkeleton ? <ChatBubbleSkeletons count={3} /> : null}
        {props.content.groups.every((group) => group.messages.length === 0) && !props.isSkeleton ? (
            <EmptyNotice message={props.content.emptyTitle} description={props.content.emptyBody} />
        ) : null}
        {props.content.groups.map((group) => (
            <Fragment key={group.id}>
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
                {group.divider === "" ? null : <Divider label={group.divider} />}
            </Fragment>
        ))}
        {props.content.isSending ? (
            <div className={SENDING}>
                <Text size="sm" tone="muted" startContent={<Spinner size="sm" label={props.content.sendingLabel} />}>
                    {props.content.sendingLabel}
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
                    variant="primary"
                    isPending={props.content.isSending}
                    isDisabled={props.isSkeleton || props.content.text.trim().length === 0}
                    onPress={props.on.send}
                >
                    {props.content.sendLabel}
                </Button>
            </div>
        </div>
    </Form>
)

const Chat = (props: ChatPartProps) => (
    <FillViewport minHeight="md" bottomInset="page">
        <SurfaceCard ariaLabel={props.content.chatTitle} composition="joined" height="fill">
            <ChatWorkspace
                label={props.content.chatTitle}
                conversationLabel={props.content.chatTitle}
                header={
                    <div className={CHAT_BAND}>
                        <Heading level={2}>{props.content.chatTitle}</Heading>
                        <Text size="xs" tone="muted">
                            {props.content.chatPrivate}
                        </Text>
                    </div>
                }
                conversation={<Conversation {...props} />}
                composer={<Composer {...props} />}
            />
        </SurfaceCard>
    </FillViewport>
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
