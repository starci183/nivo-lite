import { PaneSection, Section } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** One health tile: a figure, its label and the line under it. */
interface FactTile {
    readonly id: string
    readonly label: string
    readonly value: string
    readonly meta?: string
}

/** The resolved tiles; the block's SlotView hands them and the loading flag. */
interface FactTilesProps {
    readonly label: string
    readonly facts: ReadonlyArray<FactTile>
    readonly isLoading: boolean
}

/** The health tiles of a provider page (figure, label, meta line). */
const FactTiles = (props: FactTilesProps) => (
    <Section
        kind="figures"
        ariaLabel={props.label}
        isLoading={props.isLoading}
        items={props.facts.map((fact) => ({
            id: fact.id,
            term: fact.label,
            value: fact.value,
            ...(fact.meta === undefined ? {} : { meta: fact.meta }),
        }))}
    />
)

/** Fake rows of the same shape: the skeleton reuses the ready tree. */
const FACTS_PLACEHOLDER: ReadonlyArray<FactTile> = [
    { id: "one", label: "-", value: "-", meta: "-" },
    { id: "two", label: "-", value: "-", meta: "-" },
    { id: "three", label: "-", value: "-", meta: "-" },
]

/** The tiles' label, their slot and the copy of its states, with the retry of a failed read. */
export interface ConnectionFactsPaneProps {
    readonly label: string
    readonly facts: DataSlot<ReadonlyArray<FactTile>>
    readonly slotLabels: SlotLabels
    readonly onRetry: () => void
}

/** The health tiles of a provider page as a band of the main pane, with the slot's loading, empty and failed states. */
export const ConnectionFactsPane = (props: ConnectionFactsPaneProps) => (
    <PaneSection>
        <SlotView
            slot={props.facts}
            placeholder={FACTS_PLACEHOLDER}
            labels={props.slotLabels}
            onRetry={props.onRetry}
            render={(facts, isLoading) => <FactTiles label={props.label} facts={facts} isLoading={isLoading} />}
        />
    </PaneSection>
)
