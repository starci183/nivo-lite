import { Page, SurfaceCard } from "@starci/grammar/common"
import { WaitingLines } from "@/components/composites/WaitingLines"
import type { WaitingLine } from "@/components/composites/WaitingLines"

/** The waiting lines the redirect draws while the target is found. */
export type AgentRecordRedirectLines = ReadonlyArray<WaitingLine>

/** Copy and lines of the waiting state. */
export interface AgentRecordRedirectBaseProps {
    readonly props: {
        readonly label: string
        /** The lines drawn as a skeleton until the redirect lands. */
        readonly lines: AgentRecordRedirectLines
    }
}

/** Draws waiting lines while the instance of an old agent url is found. */
export const AgentRecordRedirectBase = (props: AgentRecordRedirectBaseProps) => (
    <Page isSkeleton measure="reading">
        <SurfaceCard ariaLabel={props.props.label}>
            <WaitingLines rows={props.props.lines} isSkeleton />
        </SurfaceCard>
    </Page>
)
