import { Section, PaneSection } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { ConnectionFactView, DataSlot, SlotLabels } from "@/modules/types"

/** Fake rows of the same shape: the skeleton reuses the ready tree. */
const FACTS_PLACEHOLDER: ReadonlyArray<ConnectionFactView> = [
    { id: "one", label: "-", value: "-", meta: "-" },
    { id: "two", label: "-", value: "-", meta: "-" },
    { id: "three", label: "-", value: "-", meta: "-" },
]

/** Copy and slot of the health tiles of a provider page. */
export interface ConnectionHealthTilesBaseProps {
    readonly props: {
        readonly label: string
        readonly facts: DataSlot<ReadonlyArray<ConnectionFactView>>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the three health tiles of a provider page (DISCIPLINE-2: figure, label, meta line) as a band of the page's main pane. */
export const ConnectionHealthTilesBase = (props: ConnectionHealthTilesBaseProps) => (
    <PaneSection>
        <SlotView
            slot={props.props.facts}
            placeholder={FACTS_PLACEHOLDER}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
            render={(facts, isLoading) => (
                <Section
                    kind="figures"
                    ariaLabel={props.props.label}
                    isLoading={isLoading}
                    items={facts.map((fact) => ({
                        id: fact.id,
                        term: fact.label,
                        value: fact.value,
                        ...(fact.meta === undefined ? {} : { meta: fact.meta }),
                    }))}
                />
            )}
        />
    </PaneSection>
)
