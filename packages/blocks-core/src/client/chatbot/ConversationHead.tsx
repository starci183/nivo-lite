import type { ReactNode } from "react"
import { Avatar, Button, PaneHeader, PaneSection } from "@starci/grammar/common"

/** What the head of a thread names: who it is with, and one line about it. */
export interface ThreadHead {
    /** The name of the customer. */
    readonly title: string
    /** The link of the customer's picture; empty draws the initials. */
    readonly avatar: string
    /** One line under the name, such as the channel; empty draws none. */
    readonly subtitle: string
}

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
    /** The control of the contact pane. */
    readonly contact: ConversationContactToggle
}

/** The head band of the thread pane: who it is with (avatar, name, channel line), the control that takes the thread over or hands it back, and the contact toggle. */
export const ConversationHead = (props: ConversationHeadProps): ReactNode => (
    <PaneSection align="center">
        <PaneHeader
            title={props.thread?.title ?? props.label}
            headingLevel={2}
            {...(props.thread === null
                ? {}
                : {
                      mark: (
                          <Avatar
                              name={props.thread.title}
                              {...(props.thread.avatar === "" ? {} : { src: props.thread.avatar })}
                              size="md"
                              isDecorative
                          />
                      ),
                  })}
            {...(props.thread === null || props.thread.subtitle === "" ? {} : { description: props.thread.subtitle })}
            actions={
                <>
                    {props.actions.map((action) => (
                        <Button
                            key={action.id}
                            intent="alternative"
                            size="sm"
                            isPending={action.isRunning}
                            onPress={action.onPress}
                        >
                            {action.label}
                        </Button>
                    ))}
                    <Button
                        intent="neutral"
                        size="sm"
                        aria-pressed={props.contact.isOpen}
                        onPress={props.contact.onToggle}
                    >
                        {props.contact.label}
                    </Button>
                </>
            }
        />
    </PaneSection>
)
