import { Button, Divider, Text } from "@starci/grammar/common"
import { LIST_HEAD_CLASS_NAME, LIST_HEAD_WRAP_CLASS_NAME } from "./classNames"

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
    <div className={LIST_HEAD_WRAP_CLASS_NAME}>
        <div className={LIST_HEAD_CLASS_NAME}>
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
        </div>
        <Divider semantics="presentation" />
    </div>
)
