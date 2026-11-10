import type { ReactNode } from "react"
import { Button, Cluster, EmptyNotice, Section, Stack, Text } from "@starci/grammar/common"
import { ChatMessageBubble } from "@/components/composites/ChatMessageBubble"
import { COLUMN_CLASS } from "./classNames"
import type { GuideBubbleMessage } from "./types"

/** The AI conversation: what the member asked the model, and its answers with their ordered steps and page links. */
interface GuideMessagesProps {
    readonly props: {
        readonly messages: ReadonlyArray<GuideBubbleMessage>
        readonly stepsLabel: string
        readonly emptyLabel: string
        readonly avatar: ReactNode
    }
    readonly on: {
        readonly go: (messageId: number, linkId: string) => void
    }
}

/** What an answer holds: its words, then the ordered steps. */
const AnswerBody = (props: { readonly message: GuideBubbleMessage; readonly stepsLabel: string; readonly emptyLabel: string }) => (
    <Stack gap="inline">
        <Text size="sm">{props.message.text}</Text>
        {props.message.steps.length === 0 ? null : (
            <Section
                kind="list"
                ariaLabel={props.stepsLabel}
                items={props.message.steps.map((step, position) => ({
                    id: `${props.message.id}-${position}`,
                    title: step,
                    leading: { position: position + 1 },
                }))}
                empty={<EmptyNotice message={props.emptyLabel} />}
            />
        )}
    </Stack>
)

/** Conversation replies: a bubble each, and under an answer the buttons that open the pages it names, in the bubbles' column. */
export const GuideMessages = (props: GuideMessagesProps) => (
    <>
        {props.props.messages.map((message) =>
            message.isUser ? (
                <ChatMessageBubble key={message.id} side="outgoing" body={<Text size="sm">{message.text}</Text>} />
            ) : (
                <Stack key={message.id} gap="row">
                    <ChatMessageBubble
                        side="incoming"
                        avatar={props.props.avatar}
                        footer={
                            message.note === null ? undefined : (
                                <Text size="xs" tone="muted">
                                    {message.note}
                                </Text>
                            )
                        }
                        body={
                            <AnswerBody
                                message={message}
                                stepsLabel={props.props.stepsLabel}
                                emptyLabel={props.props.emptyLabel}
                            />
                        }
                    />
                    {message.links.length === 0 ? null : (
                        <div className={COLUMN_CLASS}>
                            <Cluster gap="inline">
                                {message.links.map((link) => (
                                    <Button
                                        endArrow
                                        key={link.id}
                                        intent="neutral"
                                        size="sm"
                                        onPress={() => props.on.go(message.id, link.id)}
                                    >
                                        {link.label}
                                    </Button>
                                ))}
                            </Cluster>
                        </div>
                    )}
                </Stack>
            ),
        )}
    </>
)
