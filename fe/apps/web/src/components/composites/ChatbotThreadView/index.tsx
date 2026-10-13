import {
    Avatar,
    Badge,
    ChatBubble,
    ChatBubbleSkeletons,
    Divider,
    Heading,
    IconButton,
    Text,
} from "@starci/grammar/common"
import { useEffect, useRef } from "react"
import { ChatbotChips } from "@/components/branches/ChatbotChips"
import { ChatbotComposer } from "@/components/branches/ChatbotComposer"
import { nivoIconSource } from "@/components/leaves/Icon"
import {
    CENTER_CLASS_NAME,
    HEAD_CLASS_NAME,
    HEAD_TEXT_CLASS_NAME,
    PHONE_ONLY_CLASS_NAME,
    THREAD_SCROLL_CLASS_NAME,
} from "./classNames"

/** One state mark of the conversation. */
interface ChatbotThreadChip {
    readonly id: string
    readonly label: string
    readonly tone: "warning" | "accent" | "neutral"
    readonly isDot: boolean
}

/** One entry of the thread: a day divider, a system line or a message bubble. */
interface ChatbotThreadItem {
    readonly id: string
    readonly kind: "day" | "system" | "bubble"
    readonly text: string
    readonly side: "incoming" | "outgoing"
    readonly author: string
    readonly meta: string
    readonly aiMark: string | null
    readonly avatarName: string | null
    readonly deliveryText: string | null
    readonly deliveryTone: "accent" | "muted"
}

/** The open conversation: its words, its entries and the composer. */
export interface ChatbotThreadViewProps {
    /** The thread is still being fetched: three skeleton bubbles stand in. */
    readonly isResolving: boolean
    readonly hasThread: boolean
    readonly pickBody: string
    readonly backLabel: string
    readonly infoLabel: string
    readonly isInfoOpen: boolean
    readonly name: string
    readonly channel: string
    readonly chips: ReadonlyArray<ChatbotThreadChip>
    readonly entries: ReadonlyArray<ChatbotThreadItem>
    readonly canReply: boolean
    readonly lockedText: string
    readonly composerLabel: string
    readonly composerPlaceholder: string
    readonly composerHint: string
    readonly sendLabel: string
    readonly draft: string
    readonly notSentTitle: string
    readonly error: string | null
    readonly isSending: boolean
    readonly onBack: () => void
    readonly onToggleInfo: () => void
    readonly onDraft: (draft: string) => void
    readonly onSend: () => void
}

/** The centre pane of the inbox: header, bubbles and the composer (active only while the signed-in member holds the conversation). */
export const ChatbotThreadView = (props: ChatbotThreadViewProps) => {
    const endRef = useRef<HTMLDivElement | null>(null)
    const lastId = props.entries.at(-1)?.id
    useEffect(() => {
        endRef.current?.scrollIntoView({ block: "end" })
    }, [lastId, props.name])
    if (!props.hasThread) {
        return (
            <div className={CENTER_CLASS_NAME}>
                {props.isResolving ? (
                    <ChatBubbleSkeletons count={3} hasAvatar />
                ) : (
                    <Text size="sm" tone="muted">
                        {props.pickBody}
                    </Text>
                )}
            </div>
        )
    }
    return (
        <>
            <div className={HEAD_CLASS_NAME}>
                <div className={PHONE_ONLY_CLASS_NAME}>
                    <IconButton
                        source={nivoIconSource("back", "leading")}
                        label={props.backLabel}
                        onPress={props.onBack}
                    />
                </div>
                <Avatar name={props.name} size="md" isDecorative />
                <div className={HEAD_TEXT_CLASS_NAME}>
                    <Heading level={2}>{props.name}</Heading>
                    <ChatbotChips channel={props.channel} chips={props.chips} />
                </div>
                <IconButton
                    source={nivoIconSource("sidebar", "leading")}
                    label={props.infoLabel}
                    isActive={props.isInfoOpen}
                    onPress={props.onToggleInfo}
                />
            </div>
            <div className={THREAD_SCROLL_CLASS_NAME}>
                {props.entries.map((entry) => {
                    if (entry.kind !== "bubble") return <Divider key={entry.id} label={entry.text} />
                    return (
                        <ChatBubble
                            key={entry.id}
                            side={entry.side}
                            author={entry.author}
                            meta={entry.meta}
                            status={entry.aiMark === null ? undefined : <Badge tone="neutral">{entry.aiMark}</Badge>}
                            avatar={
                                entry.avatarName === null ? undefined : (
                                    <Avatar name={entry.avatarName} size="sm" isDecorative />
                                )
                            }
                            footer={
                                entry.deliveryText === null ? undefined : (
                                    <Text
                                        size="xs"
                                        weight="medium"
                                        tone={entry.deliveryTone === "accent" ? "accent" : "muted"}
                                        live="polite"
                                    >
                                        {entry.deliveryText}
                                    </Text>
                                )
                            }
                        >
                            {entry.text}
                        </ChatBubble>
                    )
                })}
                <div ref={endRef} />
            </div>
            <ChatbotComposer
                canReply={props.canReply}
                lockedText={props.lockedText}
                label={props.composerLabel}
                placeholder={props.composerPlaceholder}
                hint={props.composerHint}
                sendLabel={props.sendLabel}
                draft={props.draft}
                notSentTitle={props.notSentTitle}
                error={props.error}
                isSending={props.isSending}
                onDraft={props.onDraft}
                onSend={props.onSend}
            />
        </>
    )
}
