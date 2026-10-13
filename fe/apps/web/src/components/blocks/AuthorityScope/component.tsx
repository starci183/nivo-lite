import { Heading, NumberField, SegmentedControl, Text } from "@starci/grammar/common"
import { AuthoritySection } from "@/components/composites/AuthoritySection"
import type { AuthoritySectionView } from "@/components/composites/AuthoritySection"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { GROUP_CLASS, RULE_LIMIT_CLASS, RULE_LIST_CLASS, RULE_NAME_CLASS, RULE_ROW_CLASS } from "./classNames"

/** One mode a rule can be set to. */
export interface ModeOptionView {
    readonly value: string
    readonly label: string
}

/** One action of a department as the scope list draws it. */
export interface ScopeRowView {
    readonly key: string
    readonly name: string
    readonly modeLabel: string
    readonly modes: ReadonlyArray<ModeOptionView>
    readonly mode: string
    readonly hasLimit: boolean
    readonly limit: number
    readonly isLimitOff: boolean
}

/** One department with its actions. */
export interface ScopeGroupView {
    readonly department: string
    readonly title: string
    /** The agents that share these rules, when the department has several; empty otherwise. */
    readonly shared: string
    readonly rows: ReadonlyArray<ScopeRowView>
}

/** Copy, values and state of the automation scope section. */
export interface AuthorityScopeBaseProps {
    readonly props: {
        readonly section: AuthoritySectionView
        readonly limitLabel: string
        readonly limitHint: string
        readonly slot: DataSlot<ReadonlyArray<ScopeGroupView>>
        readonly placeholder: ReadonlyArray<ScopeGroupView>
        readonly slotLabels: SlotLabels
    }
    readonly on: {
        readonly mode: (key: string, value: string) => void
        readonly limit: (key: string, value: number) => void
        readonly save: () => void
        readonly retry: () => void
    }
}

const WHOLE = { maximumFractionDigits: 0 }

/** Draws the automation scope: the mode and VND limit of every action, by department. */
export const AuthorityScopeBase = (props: AuthorityScopeBaseProps) => {
    const view = props.props
    return (
        <SlotView slot={view.slot} placeholder={view.placeholder} labels={view.slotLabels} onRetry={props.on.retry}>
            {(groups, isSkeleton) => (
                <AuthoritySection section={view.section} isSkeleton={isSkeleton} onSave={props.on.save}>
                    {groups.map((group) => (
                        <div key={group.department} className={GROUP_CLASS}>
                            <Heading level={3}>{group.title}</Heading>
                            {group.shared === "" ? null : (
                                <Text size="xs" tone="muted">
                                    {group.shared}
                                </Text>
                            )}
                            <div className={RULE_LIST_CLASS}>
                                {group.rows.map((row) => (
                                    <div key={row.key} className={RULE_ROW_CLASS}>
                                        <div className={RULE_NAME_CLASS}>
                                            <Text weight="medium">{row.name}</Text>
                                        </div>
                                        <SegmentedControl
                                            label={row.modeLabel}
                                            isSkeleton={isSkeleton}
                                            isLabelHidden
                                            options={row.modes}
                                            value={row.mode}
                                            onValueChange={(value) => props.on.mode(row.key, value)}
                                        />
                                        {row.hasLimit ? (
                                            <div className={RULE_LIMIT_CLASS}>
                                                <NumberField
                                                    variant="secondary"
                                                    label={view.limitLabel}
                                                    minValue={0}
                                                    step={1_000_000}
                                                    formatOptions={WHOLE}
                                                    isSkeleton={isSkeleton}
                                                    isDisabled={row.isLimitOff}
                                                    value={row.limit}
                                                    onValueChange={(value) => props.on.limit(row.key, value)}
                                                />
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    <Text size="xs" tone="muted">
                        {view.limitHint}
                    </Text>
                </AuthoritySection>
            )}
        </SlotView>
    )
}
