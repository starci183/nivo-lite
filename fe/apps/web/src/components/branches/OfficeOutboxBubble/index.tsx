import { Text, MessageBubble } from "@starci/grammar/common"
import { Icon } from "@/components/leaves/Icon"
import type { OfficeOutboxView, OfficeThreadProps } from "@/modules/types"

/** What the optimistic bubble of a line being sent draws. */
type OfficeOutboxBubbleProps = {
    readonly line: OfficeOutboxView
    readonly copy: OfficeThreadProps["props"]["copy"]["outbox"]
}

/** The owner's bubble shown at once while the send is in flight, or marked failed. */
export const OfficeOutboxBubble = (props: OfficeOutboxBubbleProps) => {
    const { line, copy } = props
    return (
        <div data-status={line.isFailed ? "failed" : "sending"}>
            <MessageBubble
                side="outgoing"
                footer={
                    <Text
                        size="xs"
                        tone="muted"
                        live="polite"
                        startContent={
                            line.isFailed ? undefined : <Icon props={{ name: "messageSending", usage: "chip" }} />
                        }
                    >
                        {line.isFailed ? copy.sendFailed : copy.sending}
                    </Text>
                }
                body={
                    <Text as="p">
                        {line.parts.map((part) =>
                            part.isMention ? (
                                <Text key={part.key} as="span">
                                    {part.text}
                                </Text>
                            ) : (
                                part.text
                            ),
                        )}
                    </Text>
                }
            />
        </div>
    )
}
