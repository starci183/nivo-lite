import { DescriptionList, SurfaceCard, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels, ZaloFactView } from "@/modules/types"

/** Fake rows of the same shape: the skeleton reuses the ready tree. */
export const ZALO_FACTS_PLACEHOLDER: ReadonlyArray<ZaloFactView> = [
    { id: "one", label: "-", value: "-" },
    { id: "two", label: "-", value: "-" },
    { id: "three", label: "-", value: "-" },
    { id: "four", label: "-", value: "-" },
]

/** Copy and slot of a card of labelled facts. */
export interface ZaloConnectionFactsBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly facts: DataSlot<ReadonlyArray<ZaloFactView>>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** Draws a card of labelled facts (the overview and the setup tab are the same drawing over different facts). */
export const ZaloConnectionFactsBase = (props: ZaloConnectionFactsBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <Text size="sm" tone="muted">
            {props.props.hint}
        </Text>
        <SlotView
            slot={props.props.facts}
            placeholder={ZALO_FACTS_PLACEHOLDER}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
        >
            {(facts, isSkeleton) => (
                <DescriptionList
                    layout="columns"
                    isLoading={isSkeleton}
                    items={facts.map((fact) => ({
                        id: fact.id,
                        term: fact.label,
                        description: <Text weight="medium">{fact.value}</Text>,
                    }))}
                />
            )}
        </SlotView>
    </SurfaceCard>
)
