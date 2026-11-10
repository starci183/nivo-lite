import { SurfaceCard } from "@starci/grammar/common"
import { WaitingLines } from "@/components/composites/WaitingLines"
import type { WaitingLine } from "@/components/composites/WaitingLines"

/** The words and the skeleton lines of the landing. */
export interface AgentLandingBaseProps {
    readonly props: { readonly label: string; readonly lines: ReadonlyArray<WaitingLine> }
}

/** Draws waiting lines while the landing of an agent instance decides which tab opens. */
export const AgentLandingBase = (props: AgentLandingBaseProps) => (
    <SurfaceCard ariaLabel={props.props.label}>
        <WaitingLines rows={props.props.lines} isLoading />
    </SurfaceCard>
)
