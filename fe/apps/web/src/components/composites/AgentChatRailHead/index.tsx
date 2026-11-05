import { Button, PaneHeader, PaneSection } from "@starci/grammar/common"
import { Icon } from "@/components/leaves/Icon"

/** The words and state of the head of the conversation rail. */
interface AgentChatRailHeadProps {
    readonly title: string
    readonly newLabel: string
    /** The agent is not in yet: the new-conversation control waits while the words stay. */
    readonly isDisabled: boolean
    readonly isStarting: boolean
    readonly onStart: () => void
}

/** The head of the conversation rail: its title and the way to start another conversation. */
export const AgentChatRailHead = (props: AgentChatRailHeadProps) => (
    <PaneSection align="center">
        <PaneHeader
            title={props.title}
            actions={
                <Button
                    intent="neutral"
                    size="sm"
                    isDisabled={props.isDisabled}
                    isPending={props.isStarting}
                    startContent={<Icon props={{ name: "add", usage: "leading" }} />}
                    onPress={props.onStart}
                >
                    {props.newLabel}
                </Button>
            }
        />
    </PaneSection>
)
