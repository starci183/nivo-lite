import type { ReactNode, ReactElement } from "react"
import { Badge, Button, Cluster, IconButton, Text, Tooltip, MessageBubble, MessageStatus } from "@starci/grammar/common"
import type { MessageStatusProps } from "@starci/grammar/common"
import { ChatMessageFiles } from "@/components/leaves/ChatMessageFiles"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { OfficeBodyPart, OfficeMessageView, OfficeThreadProps } from "@/modules/types"
import { AVATAR_SLOT_CLASS_NAME, NOTICE_CLASS_NAME } from "./classNames"

/** What one chat line draws. */
type OfficeMessageRowProps = {
    readonly message: OfficeMessageView
    /** The avatar, drawn once per group by the thread. */
    readonly avatar: ReactNode
    readonly copy: OfficeThreadProps["props"]["copy"]["message"]
    /** The status line under this bubble: the view carries one only for my last line, and only while nothing waits to send. */
    readonly receipt?: Extract<MessageStatusProps, { readonly kind: "receipt" }>
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
                <Text key={part.key} as="span">
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
    readonly copy: OfficeThreadProps["props"]["copy"]["message"]
    readonly isCopied: boolean
    readonly onCopy: () => void
    readonly onReply: (handle: string) => void
}

/** The hover toolbar of a bubble: icon actions with tooltips, and the lead link when the message has one. */
const MessageActions = ({ message, copy, isCopied, onCopy, onReply }: MessageActionsProps) => (
    <>
        <Tooltip
            content={isCopied ? copy.copied : copy.copyText}
            trigger={
                <IconButton
                    intent="neutral"
                    source={nivoIconSource(isCopied ? "copied" : "copy", "leading")}
                    label={isCopied ? copy.copied : copy.copyText}
                    onPress={onCopy}
                />
            }
        />
        {message.replyHandle === null ? null : (
            <Tooltip
                content={copy.reply}
                trigger={
                    <IconButton
                        intent="neutral"
                        source={nivoIconSource("reply", "leading")}
                        label={copy.reply}
                        onPress={() => onReply(message.replyHandle ?? "")}
                    />
                }
            />
        )}
        {message.leadHref === null ? null : (
            <Tooltip
                content={message.leadLabel}
                trigger={
                    <IconButton
                        intent="neutral"
                        source={nivoIconSource("openLead", "leading")}
                        label={message.leadLabel}
                        href={message.leadHref}
                    />
                }
            />
        )}
    </>
)

/** One chat line: a bubble of a person, an agent or me, or a centred notice for a system line. */
export const OfficeMessageRow = (props: OfficeMessageRowProps): ReactElement => {
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
                            {props.copy.cmdOpenWork}
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

    const receipt = props.receipt === undefined ? null : <MessageStatus {...props.receipt} />
    const bubble = (
        <MessageBubble
            side={message.side}
            author={message.author ?? undefined}
            avatar={
                message.side === "outgoing" ? undefined : <div className={AVATAR_SLOT_CLASS_NAME}>{props.avatar}</div>
            }
            status={message.isAi ? <Badge tone="neutral">{props.copy.aiBadge}</Badge> : undefined}
            footer={
                message.files.length === 0 ? (
                    receipt
                ) : (
                    <>
                        <ChatMessageFiles files={message.files} />
                        {receipt}
                    </>
                )
            }
            actions={
                <MessageActions
                    message={message}
                    copy={props.copy}
                    isCopied={props.isCopied}
                    onCopy={onCopy}
                    onReply={props.onReply}
                />
            }
            body={
                <>
                    <Body parts={message.parts} />
                    {message.showTime ? (
                        <Text as="p" size="xs" tone="muted">
                            {message.time}
                        </Text>
                    ) : null}
                </>
            }
        />
    )
    return bubble
}
