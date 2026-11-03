import { Timeline, Section } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
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
        <Section id="previous-steps-title" title={p.title}>
            <SlotView
                slot={p.slot}
                placeholder={PLACEHOLDER}
                labels={p.labels}
                render={(steps, isSkeleton) => (
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
            />
        </Section>
    )
}
