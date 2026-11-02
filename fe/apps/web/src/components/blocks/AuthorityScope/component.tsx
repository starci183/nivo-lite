import { Button, Grid, NumberField, Section, SegmentedControl, Text } from "@starci/grammar/common"
import { AuthoritySection } from "@/components/frames/AuthoritySection"
import type { AuthoritySectionView } from "@/components/frames/AuthoritySection"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

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

/** The scope remains a form value per action, with department and action headings owned by their regions. */
export const AuthorityScopeBase = (props: AuthorityScopeBaseProps) => {
    const view = props.props
    return (
        <SlotView
            slot={view.slot}
            placeholder={view.placeholder}
            labels={view.slotLabels}
            onRetry={props.on.retry}
            render={(groups, isSkeleton) => (
                <AuthoritySection
                    section={view.section}
                    footer={
                        <Button
                            intent="commit"
                            isPending={view.section.isPending}
                            isLoading={isSkeleton}
                            onPress={props.on.save}
                        >
                            {view.section.saveLabel}
                        </Button>
                    }
                >
                    {groups.map((group) => (
                        <Section
                            key={group.department}
                            title={group.title}
                            headingLevel={3}
                            {...(group.shared === "" ? {} : { description: group.shared })}
                            isLoading={isSkeleton}
                        >
                            {group.rows.map((row) => (
                                <Section key={row.key} title={row.name} headingLevel={4}>
                                    <Grid kind="form" columns={2}>
                                        <SegmentedControl
                                            label={row.modeLabel}
                                            isLoading={isSkeleton}
                                            isLabelHidden
                                            options={row.modes}
                                            value={row.mode}
                                            onValueChange={(value) => props.on.mode(row.key, value)}
                                        />
                                        {row.hasLimit ? (
                                            <NumberField
                                                label={view.limitLabel}
                                                minValue={0}
                                                step={1_000_000}
                                                formatOptions={WHOLE}
                                                isLoading={isSkeleton}
                                                isDisabled={row.isLimitOff}
                                                value={row.limit}
                                                onValueChange={(value) => props.on.limit(row.key, value)}
                                            />
                                        ) : null}
                                    </Grid>
                                </Section>
                            ))}
                        </Section>
                    ))}
                    <Text size="xs" tone="muted">
                        {view.limitHint}
                    </Text>
                </AuthoritySection>
            )}
        />
    )
}
