import {
    Alert,
    Button,
    EmptyNotice,
    Section,
    Meter,
    Select,
    Stack,
    Stepper,
    Text,
    Textarea,
} from "@starci/grammar/common"
import { LeadPanel } from "@/components/frames/LeadPanel"
import { SlotView } from "@/components/composites/SlotView"
import { nivoIconSource } from "@/components/leaves/Icon"

import type { DataSlot, SlotLabels } from "@/modules/types"

/** One recorded piece of evidence, already resolved to text. */
export interface EvidenceView {
    readonly id: string
    readonly byline: string
    readonly text: string
}

/** What the card shows about one lead, all of it already worded. */
export interface OutcomeView {
    readonly fact: string
    readonly steps: ReadonlyArray<{ readonly id: string; readonly label: string; readonly state?: "error" }>
    readonly currentStepId: string
    readonly meterValue: number
    readonly meterMax: number
    readonly meterValueLabel: string
    readonly evidenceNote: string
    readonly stage: string
    readonly wonNote: string | null
    readonly recordedTitle: string
    readonly recorded: ReadonlyArray<EvidenceView>
}

/** The words of the card and its form. */
export interface OutcomeLabels {
    readonly title: string
    readonly stepperLabel: string
    readonly meterLabel: string
    readonly stageLabel: string
    readonly stageOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly evidenceLabel: string
    readonly evidenceHint: string
    readonly recordLabel: string
    readonly failTitle: string
    readonly noEvidenceTitle: string
    readonly noEvidenceHint: string
    readonly slot: SlotLabels
}

/** The words and state of the outcome card. */
export interface LeadOutcomeBaseProps {
    readonly props: {
        readonly slot: DataSlot<OutcomeView>
        readonly labels: OutcomeLabels
        readonly evidenceText: string
        readonly error: string | null
        readonly isPending: boolean
    }
    readonly on: {
        readonly stage: (value: string) => void
        readonly evidence: (value: string) => void
        readonly submit: () => void
    }
}

const PLACEHOLDER: OutcomeView = {
    fact: "",
    steps: [],
    currentStepId: "",
    meterValue: 0,
    meterMax: 1,
    meterValueLabel: "",
    evidenceNote: "",
    stage: "",
    wonNote: null,
    recordedTitle: "",
    recorded: ["a", "b", "c"].map((id) => ({ id, byline: "", text: "" })),
}

/** The outcome card: where the journey stands, the form that records a stage change with its evidence and the evidence already kept. */
export const LeadOutcomeBase = (props: LeadOutcomeBaseProps) => {
    const l = props.props.labels
    const { props: p, on } = props
    return (
        <LeadPanel anchor="outcome" label={l.title}>
            <SlotView
                slot={p.slot}
                placeholder={{ ...PLACEHOLDER, recordedTitle: l.evidenceLabel }}
                labels={l.slot}
                render={(view, isLoading) => (
                    <Stack gap="region">
                        <Text size="sm" tone="muted" isLoading={isLoading}>
                            {view.fact}
                        </Text>
                        <Stepper
                            label={l.stepperLabel}
                            steps={view.steps}
                            currentStepId={view.currentStepId}
                            isLoading={isLoading}
                        />
                        <Stack gap="inline">
                            <Meter
                                label={l.meterLabel}
                                value={view.meterValue}
                                maxValue={view.meterMax}
                                valueLabel={view.meterValueLabel}
                                isLoading={isLoading}
                            />
                            <Text as="p" size="xs" tone="muted" isLoading={isLoading}>
                                {view.evidenceNote}
                            </Text>
                        </Stack>
                        {renderOutcomeFields({ l, view, on, p, isLoading })}
                    </Stack>
                )}
            />
        </LeadPanel>
    )
}

/** Inputs needed to build the LeadOutcomeContent section. */
interface RenderOutcomeFieldsContext {
    readonly l: OutcomeLabels
    readonly view: OutcomeView
    readonly on: LeadOutcomeBaseProps["on"]
    readonly p: LeadOutcomeBaseProps["props"]
    readonly isLoading: boolean
}
/** Builds the LeadOutcomeContent section from the current view. */
const renderOutcomeFields = ({ l, view, on, p, isLoading }: RenderOutcomeFieldsContext) => (
    <>
        <Stack gap="section">
            <Select
                label={l.stageLabel}
                options={l.stageOptions}
                value={view.stage}
                isLoading={isLoading}
                onValueChange={(value) => value && on.stage(value)}
            />
            {view.wonNote === null ? null : (
                <Text as="p" size="sm" tone="muted">
                    {view.wonNote}
                </Text>
            )}
            <Textarea
                label={l.evidenceLabel}
                description={l.evidenceHint}
                rows={4}
                value={p.evidenceText}
                isLoading={isLoading}
                onValueChange={on.evidence}
            />
            {p.error === null ? null : <Alert title={l.failTitle} description={p.error} tone="negative" />}
            <Button
                intent="commit"
                isPending={p.isPending}
                isDisabled={p.evidenceText.trim().length === 0}
                isLoading={isLoading}
                onPress={on.submit}
            >
                {l.recordLabel}
            </Button>
        </Stack>
        {renderRecorded({ l, view, isLoading })}
    </>
)

/** The evidence already kept, or the notice that none is. */
const renderRecorded = ({ l, view, isLoading }: Pick<RenderOutcomeFieldsContext, "l" | "view" | "isLoading">) => (
    <Section
        kind="list"
        title={view.recordedTitle}
        headingLevel={3}
        isLoading={isLoading}
        empty={<EmptyNotice message={l.noEvidenceTitle} description={l.noEvidenceHint} />}
        items={view.recorded.map((item) => ({
            id: item.id,
            title: l.evidenceLabel,
            description: item.byline,
            leading: { icon: nivoIconSource("blog", "chip") },
            detail: (
                <Text as="p" size="sm" isLoading={isLoading}>
                    {item.text}
                </Text>
            ),
        }))}
    />
)
