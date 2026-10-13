import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import { AgentDashboardFrame } from "@/features/agent-dashboard"
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared"

/** Copy and data of the workbench when its data could not be read. */
export interface VideoWorkbenchPageBaseProps {
    readonly props: {
        readonly dashboard: AgentDashboardData
        readonly tabLabel: string
        readonly title: string
        readonly body: string
    }
}

/** Draws the workbench frame with one failed library tab: the page keeps its chrome and says what went wrong. */
export const VideoWorkbenchPageBase = (props: VideoWorkbenchPageBaseProps) => (
    <AgentDashboardFrame
        module="video"
        data={props.props.dashboard}
        figures={[]}
        figuresFailed
        tabs={[
            {
                id: "library",
                label: props.props.tabLabel,
                content: (
                    <SurfaceCard ariaLabel={props.props.title}>
                        <EmptyNotice message={props.props.title} description={props.props.body} />
                    </SurfaceCard>
                ),
            },
        ]}
    />
)
