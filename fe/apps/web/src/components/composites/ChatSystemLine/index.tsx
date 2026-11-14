import { Cluster, Text } from "@starci/grammar/common"

/** What a system line says and when. */
interface ChatSystemLineProps {
    readonly text: string
}

/** A small centred line between messages: a milestone of the conversation, drawn like a day separator but without a rule. */
export const ChatSystemLine = (props: ChatSystemLineProps) => (
    <Cluster gap="inline" justify="center">
        <Text size="xs" tone="muted">
            {props.text}
        </Text>
    </Cluster>
)
