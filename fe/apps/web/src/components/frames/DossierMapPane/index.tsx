import { BubbleMap, Select } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { PaneHead } from "@/components/composites/PaneHead"
import type { MapView } from "@/hooks/brain"

/** The words of the map head. */
interface DossierMapHeadCopy {
    readonly title: string
    readonly description: string
    readonly back: string
}

/** What the head band of the map draws. */
interface DossierMapHeadProps {
    readonly view: MapView
    readonly copy: DossierMapHeadCopy
    readonly onFilter: (value: string | null) => void
    readonly onBack: () => void
}

/** The head band over the map: what it shows, and the status filter that dims the other statuses. */
export const DossierMapHead = (props: DossierMapHeadProps) => (
    <PaneHead
        title={props.copy.title}
        headingLevel={1}
        description={props.copy.description}
        isLoading={props.view.isWaiting}
        back={{ label: props.copy.back, onPress: props.onBack }}
        actions={
            <Select
                label={props.view.filterLabel}
                isLabelHidden
                options={props.view.filters}
                value={props.view.filter}
                onValueChange={props.onFilter}
            />
        }
    />
)

/** What the map pane draws. */
interface DossierMapPaneProps {
    readonly view: MapView
    readonly onSelect: (id: string | null) => void
    readonly onRetry: () => void
}

/** The orbit graph of the dossiers: the workspace in the centre, its categories around it, each dossier painted by status. */
export const DossierMapPane = (props: DossierMapPaneProps) => (
    <SlotView
        slot={props.view.slot}
        placeholder={props.view.placeholder}
        labels={props.view.slotLabels}
        onRetry={props.onRetry}
        render={(content, isLoading) => (
            <BubbleMap
                label={props.view.label}
                nodes={content.nodes}
                edges={content.edges}
                selectedId={props.view.selectedId}
                onSelect={props.onSelect}
                emptyLabel={props.view.emptyLabel}
                isLoading={isLoading}
                height="lg"
            />
        )}
    />
)
export type { MapView } from "@/hooks/brain"
