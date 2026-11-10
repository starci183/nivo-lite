import { FlowGraph, FlowGraphLegend, Section, type FlowGraphPositions } from "@starci/grammar/common"
import { useState } from "react"
import type { StepsMapView } from "@/modules/types"

/** What the map card of a workflow draws, and what pressing a step does. */
interface AgentWorkflowMapProps {
    readonly props: {
        readonly title: string
        readonly label: string
        readonly caption: string
        readonly emptyLabel: string
        readonly flow: StepsMapView
        /** The step whose drawer is open, outlined; null when none is. */
        readonly selectedId: string | null
        readonly isLoading: boolean
    }
    readonly on: {
        /** Opens the drawer of a step. */
        readonly pressStep: (nodeKey: string) => void
    }
}

/**
 * The card map of the version that runs, in a card: its title above, the white step cards on the well with their kind icons, the
 * branch ports of a condition and the dashed back edges; under the card the kind legend and the caption. Pressing a step opens its
 * settings.
 */
export const AgentWorkflowMap = (props: AgentWorkflowMapProps) => {
    const { flow } = props.props
    const [positions, setPositions] = useState<FlowGraphPositions>({})
    return (
        <Section
            title={props.props.title}
            headingLevel={2}
            caption={props.props.caption}
            isLoading={props.props.isLoading}
        >
            <FlowGraph
                height="fill"
                label={props.props.label}
                nodes={flow.nodes}
                edges={flow.edges}
                layout="steps"
                statusLabels={flow.statusLabels}
                emptyLabel={props.props.emptyLabel}
                isLoading={props.props.isLoading}
                selectedId={props.props.selectedId}
                onNodePress={props.on.pressStep}
                background="dots"
                isEditable
                positions={positions}
                onPositionsChange={setPositions}
            />
            <FlowGraphLegend items={flow.legend} />
        </Section>
    )
}
