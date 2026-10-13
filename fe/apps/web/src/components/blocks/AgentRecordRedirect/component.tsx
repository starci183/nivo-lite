import { Skeleton, SurfaceCard } from "@starci/grammar/common"

/** Copy of the waiting state of an old agent url. */
export interface AgentRecordRedirectBaseProps {
    readonly props: { readonly label: string }
}

/** Draws skeleton lines while the instance of an old agent url is found. */
export const AgentRecordRedirectBase = (props: AgentRecordRedirectBaseProps) => (
    <SurfaceCard ariaLabel={props.props.label}>
        <Skeleton shape="text" lines={2} />
    </SurfaceCard>
)
