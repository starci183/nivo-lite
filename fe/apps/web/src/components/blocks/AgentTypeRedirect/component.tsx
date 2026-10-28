import { SurfaceCard } from "@starci/grammar/common"
import { WaitingLines } from "@/components/composites/WaitingLines"
import type { WaitingLine } from "@/components/composites/WaitingLines"

/** The waiting lines the redirect draws while the target is found. */
export type AgentTypeRedirectLines = ReadonlyArray<WaitingLine>

/** Copy and lines of the waiting state. */
export interface AgentTypeRedirectBaseProps {
    readonly props: {
        readonly label: string
        /** The lines drawn as a skeleton until the redirect lands. */
        readonly lines: AgentTypeRedirectLines
    }
}

/** Draws waiting lines while the redirect of an old tab url is decided. */
export const AgentTypeRedirectBase = (props: AgentTypeRedirectBaseProps) => (
    <SurfaceCard ariaLabel={props.props.label}>
        <WaitingLines rows={props.props.lines} isSkeleton />
    </SurfaceCard>
)
