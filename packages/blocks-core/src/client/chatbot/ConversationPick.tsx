import type { ReactNode } from "react"
import { EmptyNotice, PaneSection } from "@starci/grammar/common"

/** The words of the pane that stands while no thread is chosen. */
interface ConversationPickProps {
    readonly message: string
}

/** The thread pane before a thread is chosen: one notice that says to pick a conversation. */
export const ConversationPick = (props: ConversationPickProps): ReactNode => (
    <PaneSection align="center" grow>
        <EmptyNotice frame="frameless" message={props.message} />
    </PaneSection>
)
