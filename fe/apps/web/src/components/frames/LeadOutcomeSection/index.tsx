import { Button, Section, Stack, Stepper, Text } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { LeadOutcomePane, LeadOutcomeView, LeadPanesOn } from "@/modules/types"

/** What the outcome region draws and its one command. */
interface LeadOutcomeSectionProps {
    readonly pane: LeadOutcomePane
    readonly on: Pick<LeadPanesOn, "outcomeOpen">
}

const PLACEHOLDER: LeadOutcomeView = {
    steps: [],
    currentStepId: "",
    evidenceNote: "",
    stage: "",
    wonNote: null,
    recorded: [],
}

/** The aside's outcome: where the journey stands, how much evidence backs it, and the command that opens the dialog that records one. */
export const LeadOutcomeSection = (props: LeadOutcomeSectionProps) => {
    const { pane, on } = props
    const l = pane.labels
    return (
        <SlotView
            slot={pane.slot}
            placeholder={PLACEHOLDER}
            labels={l.slot}
            render={(view, isLoading) => (
                <Section id="outcome" title={l.title} headingLevel={2} isLoading={isLoading}>
                    <Stack gap="row">
                        <Stepper
                            kind="bar"
                            label={l.stepperLabel}
                            steps={view.steps}
                            currentStepId={view.currentStepId}
                            isLoading={isLoading}
                        />
                        <Text as="p" size="xs" tone="muted" isLoading={isLoading}>
                            {view.evidenceNote}
                        </Text>
                        <Button intent="neutral" size="sm" isLoading={isLoading} onPress={on.outcomeOpen}>
                            {l.recordLabel}
                        </Button>
                    </Stack>
                </Section>
            )}
        />
    )
}
