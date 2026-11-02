import { EmptyNotice, Pane, PaneGrid, PaneSection } from "@starci/grammar/common"

/** The notice shown instead of the panes. */
interface AgentSetupNoticeProps {
    readonly label: string
    readonly message: string
}

/** Draws the permission notice in the setup pane's existing content position. */
export const AgentSetupNotice = (props: AgentSetupNoticeProps) => (
    <PaneGrid label={props.label} areas={["notice"]}>
        <Pane area="notice">
            <PaneSection align="center">
                <EmptyNotice message={props.message} />
            </PaneSection>
        </Pane>
    </PaneGrid>
)
