import { Button, EmptyNotice, SurfaceCard } from "@starci/grammar/common"

/** Copy of the workbench slot while it loads. */
export interface AgentWorkbenchLoadingPageBaseProps {
    readonly props: { readonly title: string; readonly body: string; readonly setupLabel: string }
}

/** Draws the workbench slot while it loads: one card with its content as a skeleton. */
export const AgentWorkbenchLoadingPageBase = (props: AgentWorkbenchLoadingPageBaseProps) => (
    <SurfaceCard ariaLabel={props.props.title} isLoading>
        <EmptyNotice message={props.props.title} description={props.props.body} />
        <Button intent="neutral" isLoading isDisabled>
            {props.props.setupLabel}
        </Button>
    </SurfaceCard>
)
