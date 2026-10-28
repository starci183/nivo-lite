import { Button, EmptyNotice, Page, SurfaceCard } from "@starci/grammar/common"

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
    <Page header={{ title: props.props.title }} measure="product">
        <SurfaceCard ariaLabel={props.props.title}>
            <EmptyNotice message={props.props.title} description={props.props.body} />
            <Button intent="neutral" href={props.props.setupHref}>
                {props.props.setupLabel}
            </Button>
        </SurfaceCard>
    </Page>
)
