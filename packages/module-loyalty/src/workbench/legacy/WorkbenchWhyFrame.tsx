// legacy: delete when Loyalty becomes a JSON module
import type { ReactNode } from "react"
import { Pane, PaneGrid, PaneSection } from "@starci/grammar/common"
import { WorkbenchWhy } from "./WorkbenchWhy"
import type { WorkbenchWhyLabels, WorkbenchWhyView } from "@nivo-lite/agent-sdk/workbench/view"

/** The resolved explanation and labels framing the owner's list content. */
interface WorkbenchWhyFrameProps {
    readonly children: ReactNode
    readonly label: string
    readonly listLabel: string
    readonly openLabel: string
    readonly closeLabel: string
    readonly view: WorkbenchWhyView | null
    readonly labels: WorkbenchWhyLabels
    readonly onClose: () => void
}

/** The responsive list/explanation layout: flush panes on desktop and the same explanation in a phone drawer. */
export const WorkbenchWhyFrame = (props: WorkbenchWhyFrameProps): ReactNode => (
    <PaneGrid
        label={props.label}
        areas={{ base: ["list"], medium: ["list why"] }}
        columns={{ base: ["fill"], medium: ["fill", "wide"] }}
    >
        <Pane area="list" scroll label={props.listLabel}>
            <PaneSection grow>{props.children}</PaneSection>
        </Pane>
        <Pane
            area="why"
            scroll
            label={props.label}
            collapse="drawer"
            collapseLabel={props.label}
            openLabel={props.openLabel}
            closeLabel={props.closeLabel}
            isOpen
            onOpenChange={(isOpen) => {
                if (!isOpen) props.onClose()
            }}
        >
            <WorkbenchWhy view={props.view} labels={props.labels} decision={null} isLoading={false} />
        </Pane>
    </PaneGrid>
)
