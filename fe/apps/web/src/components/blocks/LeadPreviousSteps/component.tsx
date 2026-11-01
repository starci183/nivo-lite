import { Region, SectionHeader, Stack, Timeline } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** One earlier step, already worded. */
export interface PreviousStepView {
    readonly id: string
    readonly title: string
    readonly description: string
}

/** The words and data of the earlier-steps section. */
export interface LeadPreviousStepsBaseProps {
    readonly props: {
        readonly slot: DataSlot<ReadonlyArray<PreviousStepView>>
        readonly title: string
        readonly labels: SlotLabels
    }
}

const PLACEHOLDER: ReadonlyArray<PreviousStepView> = [{ id: "step", title: "", description: "" }]

/** The earlier steps of a lead, newest first; a lead with none shows nothing. */
export const LeadPreviousStepsBase = (props: LeadPreviousStepsBaseProps) => {
    const { props: p } = props
    return (
        <Region labelledBy="previous-steps-title">
            <Stack gap="section">
                <SectionHeader id="previous-steps-title" level={2} title={p.title} />
                <SlotView slot={p.slot} placeholder={PLACEHOLDER} labels={p.labels}>
                    {(steps, isSkeleton) => (
                        <Timeline
                            label={p.title}
                            isLoading={isSkeleton}
                            items={steps.map((step) => ({
                                id: step.id,
                                title: step.title,
                                description: step.description,
                            }))}
                        />
                    )}
                </SlotView>
            </Stack>
        </Region>
    )
}
