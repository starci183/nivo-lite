import { CheckboxGroup, Heading, Text, Textarea } from "@starci/grammar/common"
import { AuthoritySection } from "@/components/composites/AuthoritySection"
import type { AuthoritySectionView } from "@/components/composites/AuthoritySection"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { REQUIRED_LIST_CLASS, REQUIRED_ROW_CLASS } from "./classNames"

/** One detail an action can require. */
export interface FieldOptionView {
    readonly value: string
    readonly label: string
}

/** The details one action requires before NIVO acts alone. */
export interface RequiredRowView {
    readonly key: string
    readonly label: string
    readonly value: ReadonlyArray<string>
}

/** The limits note and every action's required details. */
export interface LimitsView {
    readonly rows: ReadonlyArray<RequiredRowView>
}

/** Copy, values and state of the limits section. */
export interface AuthorityLimitsBaseProps {
    readonly props: {
        readonly section: AuthoritySectionView
        readonly noteLabel: string
        readonly noteHint: string
        readonly requiredTitle: string
        readonly requiredHint: string
        readonly fields: ReadonlyArray<FieldOptionView>
        readonly slot: DataSlot<LimitsView>
        readonly placeholder: LimitsView
        readonly slotLabels: SlotLabels
        readonly note: string
    }
    readonly on: {
        readonly note: (value: string) => void
        readonly required: (key: string, value: ReadonlyArray<string>) => void
        readonly save: () => void
        readonly retry: () => void
    }
}

/** Draws the limits section: what needs the owner first, and the details each action must have. */
export const AuthorityLimitsBase = (props: AuthorityLimitsBaseProps) => {
    const view = props.props
    return (
        <SlotView slot={view.slot} placeholder={view.placeholder} labels={view.slotLabels} onRetry={props.on.retry}>
            {(limits, isSkeleton) => (
                <AuthoritySection section={view.section} isSkeleton={isSkeleton} onSave={props.on.save}>
                    <Textarea
                        variant="secondary"
                        isSkeleton={isSkeleton}
                        label={view.noteLabel}
                        description={view.noteHint}
                        rows={3}
                        value={view.note}
                        onValueChange={props.on.note}
                    />
                    <div>
                        <Heading level={3}>{view.requiredTitle}</Heading>
                        <Text size="sm" tone="muted">
                            {view.requiredHint}
                        </Text>
                    </div>
                    <div className={REQUIRED_LIST_CLASS}>
                        {limits.rows.map((row) => (
                            <div key={row.key} className={REQUIRED_ROW_CLASS}>
                                <CheckboxGroup
                                    variant="secondary"
                                    label={row.label}
                                    orientation="horizontal"
                                    isSkeleton={isSkeleton}
                                    options={view.fields}
                                    value={row.value}
                                    onValueChange={(value) => props.on.required(row.key, value)}
                                />
                            </div>
                        ))}
                    </div>
                </AuthoritySection>
            )}
        </SlotView>
    )
}
