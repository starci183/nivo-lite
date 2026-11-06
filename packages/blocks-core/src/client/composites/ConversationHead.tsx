import type { ReactNode } from "react"
import { Avatar, Button, Cluster, Heading, PaneSection, Stack, Text } from "@starci/grammar/common"
import type { ThreadHead } from "../../rows/conversation.types"

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

/** The control that shows or hides the contact pane beside the thread. */
export interface ConversationContactToggle {
    /** The accessible name of the control. */
    readonly label: string
    /** Whether the contact pane is shown now. */
    readonly isOpen: boolean
    /** Shows or hides the contact pane. */
    readonly onToggle: () => void
}

/** The heading of the thread and the actions beside it. */
interface ConversationHeadProps {
    /** The name of the pane, drawn as the heading when the thread has no record of its own. */
    readonly label: string
    /** Who the thread is with; null draws the name of the pane. */
    readonly thread: ThreadHead | null
    readonly actions: ReadonlyArray<ConversationHeadAction>
    /** The control of the contact pane; null when the thread has none. */
    readonly contact: ConversationContactToggle | null
}

/** Who the thread is with: the avatar, the name and the line under it; the name of the pane when the thread has none. */
const HeadTitle = (props: Pick<ConversationHeadProps, "label" | "thread">): ReactNode => {
    if (props.thread === null) return <Heading level={2}>{props.label}</Heading>
    return (
        <Cluster gap="inline" wrap={false} align="center">
            <Avatar name={props.thread.title} size="md" isDecorative />
            <Stack gap="inline">
                <Heading level={2}>{props.thread.title}</Heading>
                {props.thread.subtitle === "" ? null : (
                    <Text size="sm" tone="muted">
                        {props.thread.subtitle}
                    </Text>
                )}
            </Stack>
        </Cluster>
    )
}

/** The head band of the thread pane: who it is with, and the actions that hand the thread to a person or close it. */
export const ConversationHead = (props: ConversationHeadProps): ReactNode => (
    <PaneSection align="center">
        <Cluster gap="row" wrap={false} justify="between">
            <HeadTitle label={props.label} thread={props.thread} />
            {props.actions.length === 0 && props.contact === null ? null : (
                <Cluster gap="inline" wrap={false} align="center">
                    {props.actions.map((action) => (
                        <Button
                            key={action.id}
                            intent="alternative"
                            isPending={action.isRunning}
                            onPress={action.onPress}
                        >
                            {action.label}
                        </Button>
                    ))}
                    {props.contact === null ? null : (
                        <Button intent="neutral" aria-pressed={props.contact.isOpen} onPress={props.contact.onToggle}>
                            {props.contact.label}
                        </Button>
                    )}
                </Cluster>
            )}
        </Cluster>
    </PaneSection>
)
