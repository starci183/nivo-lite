import { Skeleton, SurfaceCard } from "@starci/grammar/common"

/** Copy of the workbench slot while it loads. */
export interface AgentWorkbenchLoadingPageBaseProps {
    readonly props: { readonly title: string }
}

/** Draws the workbench slot while it loads: one card with its content as a skeleton. */
export const AgentWorkbenchLoadingPageBase = (props: AgentWorkbenchLoadingPageBaseProps) => (
    <SurfaceCard ariaLabel={props.props.title}>
        <Skeleton shape="text" lines={4} />
    </SurfaceCard>
)
