import { Button, Dialog, EmptyNotice, FlowGraphLegend, Stack, SurfaceCard } from "@starci/grammar/common"
import { AgentGraphCanvas } from "@/components/composites/AgentGraphCanvas"
import { AgentGraphMode } from "@/components/composites/AgentGraphMode"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { AgentGraphPanelView, AgentSetupCopy, StepDrawerView, StepsMapView } from "@/modules/types"

/** The card map of the agent's main workflow, the step whose drawer is open, and that drawer (drawn by the page). */
export interface AgentSetupSteps {
    readonly map: StepsMapView
    readonly selectedId: string | null
    readonly drawer: StepDrawerView
}

/** The read of the graph, the words, and the two things a person can do: switch who decides, and open a step's settings. */
interface AgentSetupMapProps {
    readonly view: AgentGraphPanelView
    readonly steps: AgentSetupSteps
    readonly isLoading: boolean
    readonly copy: AgentSetupCopy
    readonly onMode: (value: string) => void
    readonly onStep: (nodeKey: string) => void
}

/** What the body of the map card draws: the canvas, the words and the command that opens a step. */
interface MapBodyProps {
    readonly view: AgentGraphPanelView
    readonly steps: AgentSetupSteps
    readonly isLoading: boolean
    readonly copy: AgentSetupCopy
    readonly onStep: (nodeKey: string) => void
}

/** The body: a small preview of the flow and the control that opens the whole map, or a notice that there is no map. */
const MapBody = (props: MapBodyProps) => {
    const { view, copy, steps } = props
    const canvas = {
        map: steps.map,
        label: view.canvas.label,
        emptyLabel: view.canvas.emptyLabel,
        selectedId: steps.selectedId,
        isLoading: props.isLoading,
        onPress: props.onStep,
    }
    if (steps.map.nodes.length === 0 && !props.isLoading) {
        return (
            <EmptyNotice
                message={copy.mapEmptyTitle}
                description={copy.mapEmptyBody}
                iconSource={nivoIconSource("overview", "leading")}
            />
        )
    }
    return (
        <Stack gap="row">
            <AgentGraphCanvas {...canvas} size="preview" />
            <Dialog
                title={copy.mapTitle}
                closeLabel={copy.mapClose}
                size="full"
                trigger={
                    <Button intent="neutral" size="sm" endArrow isDisabled={props.isLoading}>
                        {copy.mapOpen}
                    </Button>
                }
            >
                <AgentGraphCanvas {...canvas} />
            </Dialog>
        </Stack>
    )
}

/**
 * The work map: the switch "follow the map" as a flat setting row (label and description left, switch right), then one card whose
 * section head is the title, holding a preview of the flow with "Open the map" (or a notice that there is none) and the legend as its note.
 */
export const AgentSetupMap = (props: AgentSetupMapProps) => (
    <Stack gap="row">
        <AgentGraphMode
            view={props.view.mode}
            label={props.copy.mapModeLabel}
            description={props.view.mode.hint}
            isLoading={props.isLoading}
            onMode={props.onMode}
        />
        <SurfaceCard
            label={props.copy.mapTitle}
            headingLevel={2}
            isLoading={props.isLoading}
            note={<FlowGraphLegend items={props.steps.map.legend} />}
        >
            <MapBody
                view={props.view}
                steps={props.steps}
                isLoading={props.isLoading}
                copy={props.copy}
                onStep={props.onStep}
            />
        </SurfaceCard>
    </Stack>
)
