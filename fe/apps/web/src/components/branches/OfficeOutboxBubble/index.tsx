import { ChatBubble, Text } from "@starci/grammar/common"
import type { OfficeOutboxView, OfficeText } from "@/modules/types"
import { ROW_FIRST_CLASS_NAME } from "./classNames"

/** What the optimistic bubble of a line being sent draws. */
type OfficeOutboxBubbleProps = {
    readonly line: OfficeOutboxView
    readonly text: OfficeText
}

/** The owner's bubble shown at once while the send is in flight, or marked failed. */
export const OfficeOutboxBubble = (props: OfficeOutboxBubbleProps) => {
    const { line, text } = props
    return (
        <div className={ROW_FIRST_CLASS_NAME} data-status={line.isFailed ? "failed" : "sending"}>
            <ChatBubble
                side="outgoing"
                footer={
                    <Text size="xs" tone="muted" live="polite">
                        {line.isFailed ? text("sendFailed") : text("sending")}
                    </Text>
                }
            >
                <Text as="p">
                    {line.parts.map((part) =>
                        part.isMention ? (
                            <Text key={part.key} as="span" weight="medium" tone="accent">
                                {part.text}
                            </Text>
                        ) : (
                            part.text
                        ),
                    )}
                </Text>
            </ChatBubble>
        </div>
    )
}
