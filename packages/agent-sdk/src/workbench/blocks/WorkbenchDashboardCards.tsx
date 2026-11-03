import type { ReactNode } from "react"
import { Grid } from "@starci/grammar/common"
import type { WorkbenchDashboardRegions } from "../view/view.types"
import { ConnectionsRegion } from "./ConnectionsRegion"
import { DoneRegion } from "./DoneRegion"
import { KnowledgeRegion } from "./KnowledgeRegion"
import { SlotView } from "./SlotView"

/** The three dashboard regions under every workbench overview, each failing and retrying on its own. */
export interface WorkbenchDashboardCardsProps {
    readonly regions: Pick<WorkbenchDashboardRegions, "done" | "connections" | "knowledge">
    /** Re-runs the dashboard read the three regions share. */
    readonly onRetry: () => void
}

/** What the agent finished, the connections it acts through and what it knows: one card each, in one card grid. */
export const WorkbenchDashboardCards = (props: WorkbenchDashboardCardsProps): ReactNode => (
    <Grid kind="cards" columns={3}>
        <SlotView
            {...props.regions.done}
            onRetry={props.onRetry}
            render={(done, isLoading) => (
                <DoneRegion label={props.regions.done.label} view={done} isLoading={isLoading} />
            )}
        />
        <SlotView
            {...props.regions.connections}
            onRetry={props.onRetry}
            render={(connections, isLoading) => (
                <ConnectionsRegion label={props.regions.connections.label} view={connections} isLoading={isLoading} />
            )}
        />
        <SlotView
            {...props.regions.knowledge}
            onRetry={props.onRetry}
            render={(knowledge, isLoading) => (
                <KnowledgeRegion label={props.regions.knowledge.label} view={knowledge} isLoading={isLoading} />
            )}
        />
    </Grid>
)
