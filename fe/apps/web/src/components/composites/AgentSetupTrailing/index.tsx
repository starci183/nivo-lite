import { Text } from "@starci/grammar/common"
import type { AgentSetupChatContent } from "@/modules/types"

/** The chat content the trailing lines read. */
interface AgentSetupTrailingProps {
    readonly content: AgentSetupChatContent
}

/** What stands after the last message of the setup chat: a turn that was lost, and the sending line. */
export const AgentSetupTrailing = (props: AgentSetupTrailingProps) => {
    const { content } = props
    return (
        <>
            {content.staleLabel === "" ? null : (
                <Text size="sm" tone="muted" live="polite">
                    {content.staleLabel}
                </Text>
            )}
            {content.isSending ? (
                <Text size="sm" tone="muted" live="polite">
                    {content.sendingLabel}
                </Text>
            ) : null}
        </>
    )
}
