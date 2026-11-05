import type { ReactNode } from "react"
import { Button, Cluster, Heading, PaneSection } from "@starci/grammar/common"

/** One thing a person may do with the open thread. */
export interface ConversationHeadAction {
    /** The key of the control. */
    readonly id: string
    /** The words on the control. */
    readonly label: string
    /** Whether the action is running now. */
    readonly isRunning: boolean
    /** Runs the action. */
    readonly onPress: () => void
}

/** The heading of the thread and the actions beside it. */
interface ConversationHeadProps {
    readonly label: string
    readonly actions: ReadonlyArray<ConversationHeadAction>
}

/** The head band of the thread pane: its name, and the actions that hand the thread to a person or close it. */
export const ConversationHead = (props: ConversationHeadProps): ReactNode => (
    <PaneSection align="center">
        <Cluster gap="row" wrap={false} justify="between">
            <Heading level={2}>{props.label}</Heading>
            {props.actions.length === 0 ? null : (
                <Cluster gap="inline" wrap={false}>
                    {props.actions.map((action) => (
                        <Button
                            key={action.id}
                            intent="neutral"
                            size="sm"
                            isPending={action.isRunning}
                            onPress={action.onPress}
                        >
                            {action.label}
                        </Button>
                    ))}
                </Cluster>
            )}
        </Cluster>
    </PaneSection>
)
