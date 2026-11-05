// legacy: delete when Loyalty becomes a JSON module
import type { ReactNode } from "react"
import type { WorkbenchDashboardRegions, WorkbenchExplanationView } from "@nivo-lite/agent-sdk/workbench/view"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { WorkbenchPaneRows } from "./WorkbenchPaneRows"
import { WorkbenchWhyFrame } from "./WorkbenchWhyFrame"

/** The recorded explanation of one work item and the two dashboard lists it stands beside. */
export interface WorkbenchExplanationProps {
    readonly why: WorkbenchExplanationView & { readonly label: string }
    readonly regions: Pick<WorkbenchDashboardRegions, "waiting" | "done">
    readonly onClose: () => void
    readonly onRetry: () => void
}

/** The explanation shape of every workbench: what waits and what was done on the left, the why pane of the chosen item beside it. */
export const WorkbenchExplanation = (props: WorkbenchExplanationProps): ReactNode => (
    <WorkbenchWhyFrame {...props.why} onClose={props.onClose}>
        <SlotView
            {...props.regions.waiting}
            onRetry={props.onRetry}
            render={(waiting, isLoading) => (
                <WorkbenchPaneRows
                    label={props.regions.waiting.label}
                    rows={waiting.rows}
                    openLabel={waiting.openLabel}
                    isLoading={isLoading}
                />
            )}
        />
        <SlotView
            {...props.regions.done}
            onRetry={props.onRetry}
            render={(done, isLoading) => (
                <WorkbenchPaneRows
                    label={props.regions.done.label}
                    rows={done.rows}
                    openLabel={null}
                    isLoading={isLoading}
                />
            )}
        />
    </WorkbenchWhyFrame>
)
