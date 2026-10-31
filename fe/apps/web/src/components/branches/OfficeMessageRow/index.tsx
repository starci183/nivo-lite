import type { ReactNode } from "react"
import { Badge, Button, ChatBubble, Cluster, IconButton, Text, Tooltip } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { OfficeBodyPart, OfficeMessageView, OfficeText } from "@/modules/types"
import { AVATAR_SLOT_CLASS_NAME, NOTICE_CLASS_NAME } from "./classNames"

/** What one chat line draws. */
type OfficeMessageRowProps = {
    readonly message: OfficeMessageView
    /** The avatar, drawn once per group by the thread. */
    readonly avatar: ReactNode
    readonly text: OfficeText
    /** The status line under this bubble: the view carries one only for my last line, and only while nothing waits to send. */
    readonly status: ReactNode
    /** True while this line's text shows as just copied. */
    readonly isCopied: boolean
    readonly onReply: (handle: string) => void
    readonly onCopy: (key: string, text: string) => void
}

type BodyProps = { readonly parts: ReadonlyArray<OfficeBodyPart> }

/** The body with its @mentions highlighted. */
const Body = (props: BodyProps) => (
    <Text as="p">
        {props.parts.map((part) =>
            part.isMention ? (
                <Text key={part.key} as="span" weight="medium" tone="accent">
                    {part.text}
                </Text>
            ) : (
                part.text
            ),
        )}
    </Text>
)

/** What the hover toolbar of a bubble holds: copy, reply and the lead link. */
type MessageActionsProps = {
    readonly message: OfficeMessageView
    readonly text: OfficeText
    readonly isCopied: boolean
    readonly onCopy: () => void
    readonly onReply: (handle: string) => void
}

/** The hover toolbar of a bubble: icon actions with tooltips, and the lead link when the message has one. */
const MessageActions = ({ message, text, isCopied, onCopy, onReply }: MessageActionsProps) => (
    <>
        <Tooltip content={isCopied ? text("copied") : text("copyText")}>
            <IconButton
                intent="neutral"
                source={nivoIconSource(isCopied ? "copied" : "copy", "leading")}
                label={isCopied ? text("copied") : text("copyText")}
                onPress={onCopy}
            />
        </Tooltip>
        {message.replyHandle === null ? null : (
            <Tooltip content={text("reply")}>
                <IconButton
                    intent="neutral"
                    source={nivoIconSource("reply", "leading")}
                    label={text("reply")}
                    onPress={() => onReply(message.replyHandle ?? "")}
                />
            </Tooltip>
        )}
        {message.leadHref === null ? null : (
            <Tooltip content={message.leadLabel}>
                <IconButton
                    intent="neutral"
                    source={nivoIconSource("openLead", "leading")}
                    label={message.leadLabel}
                    href={message.leadHref}
                />
            </Tooltip>
        )}
    </>
)

/** One chat line: a bubble of a person, an agent or me, or a centred notice for a system line. */
export const OfficeMessageRow = (props: OfficeMessageRowProps) => {
    const { message } = props
    const onCopy = () => props.onCopy(message.key, message.copyText)

    if (message.variant === "notice") {
        return (
            <div className={NOTICE_CLASS_NAME}>
                <Cluster gap="inline">
                    <Text size="sm" tone="muted">
                        {message.copyText}
                    </Text>
                    {message.workHref === null ? null : (
                        <Button intent="neutral" size="sm" href={message.workHref}>
                            {props.text("cmdOpenWork")}
                        </Button>
                    )}
                    {message.leadHref === null ? null : (
                        <Button intent="neutral" size="sm" href={message.leadHref}>
                            {message.leadLabel}
                        </Button>
                    )}
                </Cluster>
            </div>
        )
    }

    const bubble = (
        <ChatBubble
            side={message.side}
            author={message.author ?? undefined}
            avatar={
                message.side === "outgoing" ? undefined : <div className={AVATAR_SLOT_CLASS_NAME}>{props.avatar}</div>
            }
            status={message.isAi ? <Badge tone="neutral">{props.text("aiBadge")}</Badge> : undefined}
            footer={props.status}
            actions={
                <MessageActions
                    message={message}
                    text={props.text}
                    isCopied={props.isCopied}
                    onCopy={onCopy}
                    onReply={props.onReply}
                />
            }
        >
            <Body parts={message.parts} />
            {message.showTime ? (
                <Text as="p" size="xs" tone="muted">
                    {message.time}
                </Text>
            ) : null}
        </ChatBubble>
    )
    return bubble
}
