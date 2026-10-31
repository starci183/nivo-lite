import { Button, Cluster, Text } from "@starci/grammar/common"

/** The words and state of the head of the conversation rail. */
interface AgentChatRailHeadProps {
    readonly title: string
    readonly newLabel: string
    readonly isDisabled: boolean
    readonly isStarting: boolean
    readonly onStart: () => void
}

/** The head of the conversation rail: its title and the way to start another conversation. */
export const AgentChatRailHead = (props: AgentChatRailHeadProps) => (
    <Cluster gap="inline" justify="between">
        <Text weight="semibold">{props.title}</Text>
        <Button
            intent="neutral"
            size="sm"
            isDisabled={props.isDisabled}
            isPending={props.isStarting}
            onPress={props.onStart}
        >
            {props.newLabel}
        </Button>
    </Cluster>
)
