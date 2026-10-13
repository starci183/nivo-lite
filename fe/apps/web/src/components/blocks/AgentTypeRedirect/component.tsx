import { Skeleton, SurfaceCard } from "@starci/grammar/common"

/** Copy of the waiting state. */
export interface AgentTypeRedirectBaseProps {
    readonly props: { readonly label: string }
}

/** Draws a card of skeleton lines while the redirect is decided. */
export const AgentTypeRedirectBase = (props: AgentTypeRedirectBaseProps) => (
    <SurfaceCard ariaLabel={props.props.label}>
        <Skeleton shape="text" lines={3} />
    </SurfaceCard>
)
