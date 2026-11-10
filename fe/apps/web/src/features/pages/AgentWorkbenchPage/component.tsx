import { Button, EmptyNotice, Pane, PaneGrid, PaneSection, Stack } from "@starci/grammar/common"

/** Copy and the way on for a module that has no workbench yet. */
export interface AgentWorkbenchPageBaseProps {
    readonly props: {
        readonly title: string
        readonly body: string
        readonly setupLabel: string
        readonly setupHref: string
    }
}

/** Draws the state of a module without a workbench: it is still being built, and Setup is the way on. */
export const AgentWorkbenchPageBase = (props: AgentWorkbenchPageBaseProps) => (
    <PaneGrid label={props.props.title} areas={["main"]}>
        <Pane area="main">
            <PaneSection align="center" grow>
                <Stack gap="row">
                    <EmptyNotice message={props.props.title} description={props.props.body} />
                    <Button endArrow intent="neutral" href={props.props.setupHref}>
                        {props.props.setupLabel}
                    </Button>
                </Stack>
            </PaneSection>
        </Pane>
    </PaneGrid>
)
