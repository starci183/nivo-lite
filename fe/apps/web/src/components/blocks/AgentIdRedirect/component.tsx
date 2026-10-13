import { Skeleton, SurfaceCard } from "@starci/grammar/common"

/** Copy of the waiting state. */
export interface AgentIdRedirectBaseProps {
    readonly props: { readonly label: string }
}

/** Draws a card of skeleton lines while the instance of the agent is found. */
export const AgentIdRedirectBase = (props: AgentIdRedirectBaseProps) => (
    <SurfaceCard ariaLabel={props.props.label}>
        <Skeleton shape="text" lines={3} />
    </SurfaceCard>
)
