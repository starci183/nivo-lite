import type { ReactNode } from "react"
import { LoyaltyTierCard } from "./LoyaltyTierCard"
import { LoyaltyCategoryCard } from "./LoyaltyCategoryCard"
import { LoyaltyTierRules } from "./LoyaltyTierRules"
import { LoyaltyEarningRules } from "./LoyaltyEarningRules"
import { Button, Form, Input, Switch, Text, Grid, Stack, Cluster } from "@starci/grammar/common"
import { SettingsSection, SlotView } from "@nivo/agent-sdk/workbench"
import type { DataSlot, SlotLabels } from "@nivo/agent-sdk/workbench"
import { LoyaltyBirthdaySection } from "./LoyaltyBirthdaySection"
import { LoyaltyPromoSection } from "./LoyaltyPromoSection"
import { LoyaltyField } from "./LoyaltyField"

import type {
    CategoryTextField,
    ProgramCopy,
    ProgramSwitchField,
    ProgramTextField,
    ProgramValues,
    TierErrorView,
    TierTextField,
} from "../types"

/** Props for {@link LoyaltyProgramSettingsView}. */
export interface LoyaltyProgramSettingsViewProps {
    readonly props: {
        /** The programme read: the form draws from `values`, which are blank until it lands. */
        readonly slot: DataSlot<true>
        readonly slotLabels: SlotLabels
        readonly canEdit: boolean
        readonly isPending: boolean
        readonly copy: ProgramCopy
        readonly values: ProgramValues
        readonly errors: {
            readonly name?: string | undefined
            readonly tiers?: string | undefined
            readonly hourFrom?: string | undefined
            readonly hourTo?: string | undefined
        }
        readonly tierErrors: ReadonlyArray<TierErrorView>
        readonly canAddCategory: boolean
        readonly canAddTier: boolean
        readonly triggerOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly rewardOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly link?: string
    }
    readonly on: {
        readonly change: (field: ProgramTextField, value: string) => void
        readonly toggle: (field: ProgramSwitchField, value: boolean) => void
        readonly changeTier: (uid: string, field: TierTextField, value: string) => void
        readonly removeTier: (uid: string) => void
        readonly addTier: () => void
        readonly changeCategory: (uid: string, field: CategoryTextField, value: string) => void
        readonly removeCategory: (uid: string) => void
        readonly addCategory: () => void
        readonly submit: () => void
        readonly retry: () => void
    }
}

/** Draws the whole loyalty programme in one form with one save: earn rules, tiers, expiry, birthday, promotion limits and the public page. */
export const LoyaltyProgramSettingsView = (props: LoyaltyProgramSettingsViewProps): ReactNode => {
    const { props: p, on } = props
    return (
        <SlotView
            slot={p.slot}
            placeholder
            labels={p.slotLabels}
            onRetry={on.retry}
            render={(_ready, isSkeleton) =>
                renderSettingsForm({
                    copy: p.copy,
                    p,
                    on,
                    props,
                    values: p.values,
                    off: !p.canEdit || p.isPending || isSkeleton,
                })
            }
        />
    )
}

/** Inputs needed to build the publicTitle section. */
interface RenderPublicProgramPageContext {
    readonly copy: ProgramCopy
    readonly values: ProgramValues
    readonly off: boolean
    readonly on: LoyaltyProgramSettingsViewProps["on"]
    readonly p: LoyaltyProgramSettingsViewProps["props"]
}
/** Builds the publicTitle section from the current view. */
const renderPublicProgramPage = ({ copy, values, off, on, p }: RenderPublicProgramPageContext) => (
    <SettingsSection title={copy.publicTitle} hint={copy.publicHint}>
        <Switch
            label={copy.publicOn}
            isSelected={values.enabled}
            isDisabled={off}
            onSelectedChange={(value) => on.toggle("enabled", value)}
        />
        {p.link === undefined ? null : (
            <Input
                id="lp-public-link"
                name="publicLink"
                label={copy.publicLink}
                value={p.link}
                isReadOnly
                isCopyable
                copyLabel={copy.copy}
                copiedLabel={copy.copied}
            />
        )}
    </SettingsSection>
)

/** Inputs needed to build the expiryTitle section. */
interface RenderPointsExpiryContext {
    readonly copy: ProgramCopy
    readonly values: ProgramValues
    readonly off: boolean
    readonly on: LoyaltyProgramSettingsViewProps["on"]
}
/** Builds the expiryTitle section from the current view. */
const renderPointsExpiry = ({ copy, values, off, on }: RenderPointsExpiryContext) => (
    <SettingsSection title={copy.expiryTitle} hint={copy.expiryHint}>
        <Grid kind="form" columns={2}>
            <LoyaltyField
                id="lp-expiry-months"
                label={copy.expiryMonths}
                hint={copy.expiryMonthsHint}
                value={values.expiryMonths}
                isDisabled={off}
                onChange={(value) => on.change("expiryMonths", value)}
            />
            <LoyaltyField
                id="lp-warn-days"
                label={copy.warnDays}
                hint={copy.warnDaysHint}
                value={values.warnDays}
                isDisabled={off}
                onChange={(value) => on.change("warnDays", value)}
            />
        </Grid>
    </SettingsSection>
)

/** Inputs needed to build the save section. */
interface RenderSettingsFormContext {
    readonly copy: ProgramCopy
    readonly p: LoyaltyProgramSettingsViewProps["props"]
    readonly on: LoyaltyProgramSettingsViewProps["on"]
    readonly props: LoyaltyProgramSettingsViewProps
    readonly values: ProgramValues
    readonly off: boolean
}
/** Builds the save section from the current view. */
const renderSettingsForm = ({ copy, p, on, props, values, off }: RenderSettingsFormContext) => (
    <Form label={copy.save} isPending={p.isPending} onSubmit={on.submit}>
        <Stack gap="row">
            {p.canEdit ? null : (
                <Text size="sm" tone="muted">
                    {copy.readOnlyNote}
                </Text>
            )}
            {renderEarningRules(props, off)}

            {renderTierRules(props, off)}

            {renderPointsExpiry({ copy, values, off, on })}

            <SettingsSection title={copy.birthdayTitle}>
                <LoyaltyBirthdaySection
                    isOn={values.birthdayOn}
                    points={values.birthdayPoints}
                    rewardKey={values.birthdayReward}
                    note={values.birthdayNote}
                    isDisabled={off}
                    rewardOptions={p.rewardOptions}
                    onLabel={copy.birthdayOn}
                    pointsLabel={copy.birthdayPoints}
                    rewardLabel={copy.birthdayReward}
                    noteLabel={copy.birthdayNote}
                    noteHint={copy.birthdayNoteHint}
                    onToggle={(isOn) => on.toggle("birthdayOn", isOn)}
                    onChange={on.change}
                />
            </SettingsSection>

            <SettingsSection title={copy.promoTitle} hint={copy.promoHint}>
                <LoyaltyPromoSection
                    maxPerMonth={values.maxPerMonth}
                    batch={values.batch}
                    hourFrom={values.hourFrom}
                    hourTo={values.hourTo}
                    hourFromError={p.errors.hourFrom}
                    hourToError={p.errors.hourTo}
                    isDisabled={off}
                    maxPerMonthLabel={copy.maxPerMonth}
                    batchLabel={copy.batch}
                    batchHint={copy.batchHint}
                    hourFromLabel={copy.hourFrom}
                    hourToLabel={copy.hourTo}
                    onChange={on.change}
                />
            </SettingsSection>

            {renderPublicProgramPage({ copy, values, off, on, p })}

            {p.canEdit ? (
                <Cluster gap="inline">
                    <Button type="submit" intent="commit" isPending={p.isPending}>
                        {copy.save}
                    </Button>
                </Cluster>
            ) : null}
        </Stack>
    </Form>
)

/** Draws the category earning cards with their section controls. */
const renderEarningRules = (props: LoyaltyProgramSettingsViewProps, off: boolean) => {
    const { props: p, on } = props
    const { copy, values } = p
    return (
        <SettingsSection title={copy.earnTitle} hint={copy.earnHint}>
            <LoyaltyEarningRules {...props}>
                {values.categories.map((category) => (
                    <LoyaltyCategoryCard
                        key={category.uid}
                        category={category}
                        canRemove={p.canEdit}
                        isDisabled={off}
                        isPending={p.isPending}
                        ariaLabel={category.label || copy.categories}
                        matchLabel={copy.catMatch}
                        rateLabel={copy.catRate}
                        labelLabel={copy.catLabel}
                        removeLabel={copy.remove}
                        onChange={on.changeCategory}
                        onRemove={on.removeCategory}
                    />
                ))}
            </LoyaltyEarningRules>
        </SettingsSection>
    )
}

/** Draws the membership tier cards with their section controls. */
const renderTierRules = (props: LoyaltyProgramSettingsViewProps, off: boolean) => {
    const { props: p, on } = props
    const { copy, values } = p
    return (
        <SettingsSection title={copy.tiersTitle} hint={copy.tiersHint}>
            <LoyaltyTierRules
                {...props}
                rules={
                    <>
                        {values.tiers.map((tier, position) => (
                            <LoyaltyTierCard
                                key={tier.uid}
                                tier={tier}
                                isFirst={position === 0}
                                canRemove={p.canEdit && values.tiers.length > 1 && position > 0}
                                isDisabled={off}
                                isPending={p.isPending}
                                nameError={p.tierErrors[position]?.name}
                                spendError={p.tierErrors[position]?.minSpend}
                                nameLabel={copy.tierName}
                                spendLabel={copy.tierSpend}
                                firstHint={copy.tierFirst}
                                multiplierLabel={copy.tierMult}
                                multiplierHint={copy.tierMultHint}
                                winbackLabel={copy.tierWinback}
                                winbackHint={copy.tierWinbackHint}
                                benefitLabel={copy.tierBenefit}
                                removeLabel={copy.remove}
                                onChange={on.changeTier}
                                onRemove={on.removeTier}
                            />
                        ))}
                    </>
                }
            />
        </SettingsSection>
    )
}
