import { DescriptionList, PaneSection, Section, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels, ZaloFactView } from "@/modules/types"

/** Fake rows of the same shape: the skeleton reuses the ready tree. */
export const ZALO_FACTS_PLACEHOLDER: ReadonlyArray<ZaloFactView> = [
    { id: "one", label: "-", value: "-", meta: "-" },
    { id: "two", label: "-", value: "-", meta: "-" },
    { id: "three", label: "-", value: "-", meta: "-" },
]

/** Copy and slot of a set of labelled facts. */
export interface ZaloConnectionFactsBaseProps {
    /** `tiles`: the health band of the page, its own pane band; `saved`: the saved values inside the first setup step. */
    readonly shape: "tiles" | "saved"
    readonly props: {
        readonly label: string
        readonly facts: DataSlot<ReadonlyArray<ZaloFactView>>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

type ZaloFactsBandProps = Pick<ZaloConnectionFactsBaseProps, "props" | "on">

const SavedFacts = (props: ZaloFactsBandProps) => (
    <SlotView
        slot={props.props.facts}
        placeholder={ZALO_FACTS_PLACEHOLDER}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
        render={(facts, isLoading) => (
            <DescriptionList
                layout="columns"
                isLoading={isLoading}
                items={facts.map((fact) => ({
                    id: fact.id,
                    term: fact.label,
                    description: <Text isStrong>{fact.value}</Text>,
                }))}
            />
        )}
    />
)

/**
 * Draws labelled facts of a Zalo OA connection: the three health tiles (DISCIPLINE-2: figure, label, meta line) as a band of the
 * page's main pane, or the saved values of the first setup step as a description list.
 */
export const ZaloConnectionFactsBase = (props: ZaloConnectionFactsBaseProps) =>
    props.shape === "saved" ? (
        <SavedFacts props={props.props} on={props.on} />
    ) : (
        <PaneSection>
            <SlotView
                slot={props.props.facts}
                placeholder={ZALO_FACTS_PLACEHOLDER}
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
