import { nivoIconSource } from "@/components/leaves/Icon"
import type { ModuleIconName } from "@/modules/types"
import { ChatBubble, ChatBubbleSkeletons, Text } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import { NOTICE_ROW_CLASS_NAME } from "./classNames"

/** One resolved message row. */
interface AgentChatMessageRow {
    readonly id: string
    readonly role: "user" | "agent" | "system"
    readonly body: string
    readonly timeLabel: string
}

/** The messages of the open conversation and the words around them. */
export interface AgentChatMessagesProps {
    readonly messages: ReadonlyArray<AgentChatMessageRow>
    /** Who the own messages of the person are from: "you" in the test channel, the visitor in the customer channel. */
    readonly userAuthor: string
    readonly agentName: string
    readonly glyph: ModuleIconName
    /** The picture the owner gave the agent; null draws the NIVO unicorn mascot. */
    readonly avatarUrl?: string | null | undefined
    readonly module: string
    /** The line that says the agent is writing, or null when it is not. */
    readonly typing: string | null
    /** The messages are still loading: the thread draws waiting bubbles. */
    readonly isSkeleton: boolean
}

/** The thread of one conversation: bubbles on both sides, centred system lines and the typing line. */
export const AgentChatMessages = (props: AgentChatMessagesProps) => {
    if (props.isSkeleton) return <ChatBubbleSkeletons count={4} hasAvatar />
    return (
        <>
            {props.messages.map((message) => {
                if (message.role === "system") {
                    return (
                        <div className={NOTICE_ROW_CLASS_NAME} key={message.id}>
                            <Text size="xs" tone="muted">
                                {message.body}
                            </Text>
                        </div>
                    )
                }
                const isUser = message.role === "user"
                return (
                    <ChatBubble
                        key={message.id}
                        side={isUser ? "outgoing" : "incoming"}
                        author={isUser ? props.userAuthor : props.agentName}
                        avatar={
                            isUser ? undefined : (
                                <AgentMark
                                    glyph={nivoIconSource(props.glyph, "leading")}
                                    module={props.module}
                                    label={props.agentName}
                                    src={props.avatarUrl}
                                    size="sm"
                                />
                            )
                        }
                        meta={message.timeLabel}
                    >
                        {message.body}
                    </ChatBubble>
                )
            })}
            {props.typing === null ? null : (
                <Text size="sm" tone="muted" live="polite">
                    {props.typing}
                </Text>
            )}
        </>
    )
}
