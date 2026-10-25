import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { Badge, Button, ButtonGroup, ChatBubble, Text } from "@starci/grammar/common"
import type { OfficeBodyPart, OfficeMessageView, OfficeText } from "@/modules/types"
import { AVATAR_SLOT_CLASS_NAME, NOTICE_CLASS_NAME, ROW_FIRST_CLASS_NAME } from "./classNames"

/** What one chat line draws. */
type OfficeMessageRowProps = {
    readonly message: OfficeMessageView
    /** The avatar, drawn once per group by the thread. */
    readonly avatar: ReactNode
    readonly text: OfficeText
    /** The status line under this bubble: the view carries one only for my last line, and only while nothing waits to send. */
    readonly status: ReactNode
    readonly onReply: (handle: string) => void
}

type BodyProps = { readonly parts: ReadonlyArray<OfficeBodyPart> }

const COPIED_MS = 1500

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

/** One chat line: a bubble of a person, an agent or me, or a centred notice for a system line. */
export const OfficeMessageRow = (props: OfficeMessageRowProps) => {
    const { message } = props
    const [isCopied, setIsCopied] = useState(false)

    useEffect(() => {
        if (!isCopied) return undefined
        const timer = window.setTimeout(() => setIsCopied(false), COPIED_MS)
        return () => window.clearTimeout(timer)
    }, [isCopied])

    const onCopy = () => {
        void navigator.clipboard
            .writeText(message.copyText)
            .then(() => setIsCopied(true))
            .catch(() => setIsCopied(false))
    }

    if (message.variant === "notice") {
        return (
            <div className={NOTICE_CLASS_NAME}>
                <Text size="sm" tone="muted">
                    {message.copyText}
                </Text>
                {message.workHref === null ? null : (
                    <Button variant="ghost" size="sm" href={message.workHref}>
                        {props.text("cmdOpenWork")}
                    </Button>
                )}
                {message.leadHref === null ? null : (
                    <Button variant="ghost" size="sm" href={message.leadHref}>
                        {message.leadLabel}
                    </Button>
                )}
            </div>
        )
    }

    const replyHandle = message.replyHandle
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
                <ButtonGroup label={`${message.author ?? ""} ${message.time}`}>
                    <Button variant="secondary" size="sm" onPress={onCopy}>
                        {isCopied ? props.text("copied") : props.text("copyText")}
                    </Button>
                    {message.leadHref === null ? null : (
                        <Button variant="secondary" size="sm" href={message.leadHref}>
                            {message.leadLabel}
                        </Button>
                    )}
                    {replyHandle === null ? null : (
                        <Button variant="secondary" size="sm" onPress={() => props.onReply(replyHandle)}>
                            {props.text("reply")}
                        </Button>
                    )}
                </ButtonGroup>
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
    return message.isContinuation ? bubble : <div className={ROW_FIRST_CLASS_NAME}>{bubble}</div>
}
