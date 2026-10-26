import {
    Alert,
    Button,
    EmptyNotice,
    Heading,
    List,
    ListItem,
    Meter,
    Select,
    Stepper,
    Text,
    Textarea,
} from "@starci/grammar/common"
import { LeadPanel } from "@/components/composites/LeadPanel"
import { SlotView } from "@/components/composites/SlotView"
import { Icon } from "@/components/leaves/Icon"
import type { DataSlot, SlotLabels } from "@/modules/types"
import {
    EVIDENCE_HEAD_CLASS_NAME,
    EVIDENCE_ITEM_CLASS_NAME,
    EVIDENCE_LIST_CLASS_NAME,
    EVIDENCE_STACK_CLASS_NAME,
    FORM_STACK_CLASS_NAME,
    STACK_CLASS_NAME,
} from "./classNames"

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
    recorded: [],
}

const EVIDENCE_ICON = { name: "blog", usage: "chip" } as const

/** The outcome card: where the journey stands, the form that records a stage change with its evidence and the evidence already kept. */
export const LeadOutcomeBase = (props: LeadOutcomeBaseProps) => {
    const l = props.props.labels
    const { props: p, on } = props
    return (
        <LeadPanel anchor="outcome" label={l.title}>
            <SlotView slot={p.slot} placeholder={PLACEHOLDER} labels={l.slot}>
                {(view, isSkeleton) => (
                    <div className={STACK_CLASS_NAME}>
                        <Text size="sm" tone="muted" isSkeleton={isSkeleton}>
                            {view.fact}
                        </Text>
                        <Stepper
                            label={l.stepperLabel}
                            steps={view.steps}
                            currentStepId={view.currentStepId}
                            isLoading={isSkeleton}
                        />
                        <div className={EVIDENCE_STACK_CLASS_NAME}>
                            <Meter
                                label={l.meterLabel}
                                value={view.meterValue}
                                maxValue={view.meterMax}
                                valueLabel={view.meterValueLabel}
                                isSkeleton={isSkeleton}
                            />
                            <Text as="p" size="xs" tone="muted" isSkeleton={isSkeleton}>
                                {view.evidenceNote}
                            </Text>
                        </div>
                        {isSkeleton ? null : renderOutcomeFields({ l, view, on, p })}
                    </div>
                )}
            </SlotView>
        </LeadPanel>
    )
}

/** Inputs needed to build the LeadOutcomeContent section. */
interface RenderOutcomeFieldsContext {
    readonly l: OutcomeLabels
    readonly view: OutcomeView
    readonly on: LeadOutcomeBaseProps["on"]
    readonly p: LeadOutcomeBaseProps["props"]
}
/** Builds the LeadOutcomeContent section from the current view. */
const renderOutcomeFields = ({ l, view, on, p }: RenderOutcomeFieldsContext) => (
    <>
        <div className={FORM_STACK_CLASS_NAME}>
            <Select
                label={l.stageLabel}
                options={l.stageOptions}
                value={view.stage}
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
                onValueChange={on.evidence}
            />
            {p.error === null ? null : <Alert title={l.failTitle} description={p.error} tone="negative" />}
            <Button
                intent="commit"
                isPending={p.isPending}
                isDisabled={p.evidenceText.trim().length === 0}
                onPress={on.submit}
            >
                {l.recordLabel}
            </Button>
        </div>
        {view.recorded.length === 0 ? (
            <EmptyNotice message={l.noEvidenceTitle} description={l.noEvidenceHint} />
        ) : (
            <div className={EVIDENCE_STACK_CLASS_NAME}>
                <Heading level={3}>{view.recordedTitle}</Heading>
                <List className={EVIDENCE_LIST_CLASS_NAME} label={view.recordedTitle}>
                    {view.recorded.map((item) => (
                        <ListItem key={item.id} className={EVIDENCE_ITEM_CLASS_NAME}>
                            <div className={EVIDENCE_HEAD_CLASS_NAME}>
                                <Text
                                    as="span"
                                    size="xs"
                                    tone="muted"
                                    weight="semibold"
                                    startContent={<Icon props={EVIDENCE_ICON} />}
                                >
                                    {l.evidenceLabel}
                                </Text>
                                <Text as="span" size="xs" tone="muted">
                                    {item.byline}
                                </Text>
                            </div>
                            <Text as="p" size="sm">
                                {item.text}
                            </Text>
                        </ListItem>
                    ))}
                </List>
            </div>
        )}
    </>
)
