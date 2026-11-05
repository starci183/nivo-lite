import type { ReactNode } from "react"
import { Pane, PaneGrid, PaneSection } from "@starci/grammar/common"

/** What the conversation rail holds: its head band, the channel tabs, and the rows. */
interface AgentChatRailProps {
    readonly label: string
    /** The head band: content of the head pane. */
    readonly head: ReactNode
    /** The channel tabs under the head, or null when the agent has a single channel. */
    readonly tabs: ReactNode
    /** The conversations: they scroll under the tabs. */
    readonly children: ReactNode
}

/**
 * The inside of the conversation pane: a head band over the tabs and the scrolling rows, with the rule between the head and the
 * body that the pane head of the thread has beside it. The pane stands flush in the page grid and is a drawer on a phone.
 */
export const AgentChatRail = (props: AgentChatRailProps) => (
    <PaneGrid label={props.label} areas={["head", "body"]} rows={["auto", "fill"]}>
        <Pane area="head" surface>
            {props.head}
        </Pane>
        <Pane area="body" surface>
            {props.tabs === null ? null : <PaneSection bleed="inline">{props.tabs}</PaneSection>}
            <PaneSection scroll={{ label: props.label }}>{props.children}</PaneSection>
        </Pane>
    </PaneGrid>
)
