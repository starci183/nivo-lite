import { Fragment } from "react"
import { Cluster, Divider, Text, MessageBubble } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import { ChatMessageFiles } from "@/components/leaves/ChatMessageFiles"
import type { ChatMessageFile } from "@/components/leaves/ChatMessageFiles"
import { MESSAGES_CLASS_NAME, NOTICE_ROW_CLASS_NAME } from "./classNames"

/** One resolved message row. */
interface AgentChatMessageRow {
    readonly id: string
    readonly role: "user" | "agent" | "system"
    readonly body: string
    readonly timeLabel: string
    /** The day this message opens, or null when it continues the day of the one before. */
    readonly dayLabel: string | null
    readonly files: ReadonlyArray<ChatMessageFile>
}

/** The messages of the open conversation and the words around them. */
export interface AgentChatMessagesProps {
    readonly messages: ReadonlyArray<AgentChatMessageRow>
    /** Who the own messages of the person are from: "you" in the test channel, the visitor in the customer channel. */
    readonly userAuthor: string
    readonly agentName: string
    /** The picture the owner gave the agent; null draws the NIVO unicorn mascot. */
    readonly avatarUrl?: string | null | undefined
    /** The id of the agent: the one seed of its mark on every screen. */
    readonly seed: string
    /** The line that says the agent is writing, or null when it is not. */
    readonly typing: string | null
    /** The messages are still loading: the thread draws waiting bubbles. */
    readonly isLoading: boolean
}

/** The thread of one conversation: day dividers, bubbles on both sides, centred system lines and the typing line. */
export const AgentChatMessages = (props: AgentChatMessagesProps) => {
    if (props.isLoading) {
        return (
            <div className={MESSAGES_CLASS_NAME}>
                <MessageBubble isLoading hasAvatar />
            </div>
        )
    }
    return (
        <div className={MESSAGES_CLASS_NAME}>
            {props.messages.map((message) => {
                const day = message.dayLabel === null ? null : <Divider label={message.dayLabel} />
                if (message.role === "system") {
                    return (
                        <Fragment key={message.id}>
                            {day}
                            <div className={NOTICE_ROW_CLASS_NAME}>
                                <Text size="xs" tone="muted">
                                    {message.body}
                                </Text>
                            </div>
                        </Fragment>
                    )
                }
                const isUser = message.role === "user"
                return (
                    <Fragment key={message.id}>
                        {day}
                        <MessageBubble
                            side={isUser ? "outgoing" : "incoming"}
                            author={isUser ? props.userAuthor : props.agentName}
                            avatar={
                                isUser ? undefined : (
                                    <AgentMark
                                        label={props.agentName}
                                        seed={props.seed}
                                        src={props.avatarUrl}
                                        size="sm"
                                    />
                                )
                            }
                            meta={message.timeLabel}
                            footer={message.files.length === 0 ? undefined : <ChatMessageFiles files={message.files} />}
                            body={message.body}
                        />
                    </Fragment>
                )
            })}
            {props.typing === null ? null : (
                <Cluster gap="inline" wrap={false}>
                    <AgentMark label={props.agentName} seed={props.seed} src={props.avatarUrl} size="sm" />
                    <Text size="sm" tone="muted" live="polite">
                        {props.typing}
                    </Text>
                </Cluster>
            )}
        </div>
    )
}
