import type { ReactNode } from "react"
import { EmptyNotice, Pane, PaneGrid, PaneSection } from "@starci/grammar/common"

/** The words of the pane that stands while no thread is chosen. */
interface ConversationPickProps {
    readonly label: string
    readonly message: string
}

/** The thread pane before a thread is chosen: one notice that says to pick a conversation. */
export const ConversationPick = (props: ConversationPickProps): ReactNode => (
    <PaneGrid label={props.label} areas={["thread"]} columns={["fill"]}>
        <Pane area="thread">
            <PaneSection align="center" grow>
                <EmptyNotice message={props.message} />
            </PaneSection>
        </Pane>
    </PaneGrid>
)
