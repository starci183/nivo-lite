import { LoyaltyTierCard } from "@/components/composites/LoyaltyTierCard"
import { LoyaltyCategoryCard } from "@/components/composites/LoyaltyCategoryCard"
import type { useTranslations } from "next-intl"
import type { useLoyaltyProgramForm } from "@/hooks/rhf"
import { LoyaltyTierRules } from "@/components/composites/LoyaltyTierRules"
import { LoyaltyEarningRules } from "@/components/composites/LoyaltyEarningRules"
import { Alert, Button, Form, Input, SurfaceCard, Switch, Text } from "@starci/grammar/common"
import { LoyaltyBirthdaySection } from "@/components/composites/LoyaltyBirthdaySection"
import { LoyaltyPromoSection } from "@/components/composites/LoyaltyPromoSection"
import { LoyaltyField } from "@/components/leaves/LoyaltyField"
import { LoyaltySettingsSection } from "@/components/leaves/LoyaltySettingsSection"
import type { ProgramValues } from "@/hooks/loyaltyProgram"
import type {
    CategoryTextField,
    ProgramSwitchField,
    ProgramTextField,
    TierTextField,
} from "@/hooks/loyaltyProgramFields"
import { ACTIONS_CLASS_NAME, FIELD_PAIR_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"
import type { ProgramCopy, TierErrorView } from "@/modules/types"

/** Props for {@link LoyaltyProgramSettingsBase}. */
export interface LoyaltyProgramSettingsBaseProps {
    readonly props: {
        readonly status: "loading" | "failed" | "ready"
        readonly loadingText: string
        readonly failedTitle: string
        readonly failedDescription?: string
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
    }
}

/** Draws the whole loyalty programme in one form with one save: earn rules, tiers, expiry, birthday, promotion limits and the public page. */
export const LoyaltyProgramSettingsBase = (props: LoyaltyProgramSettingsBaseProps) => {
    const { props: p, on } = props
    const { copy, values } = p
    const off = !p.canEdit || p.isPending
    if (p.status === "failed")
        return (
            <SurfaceCard ariaLabel={p.failedTitle}>
                <Alert title={p.failedTitle} description={p.failedDescription} tone="negative" />
            </SurfaceCard>
        )
    if (p.status === "loading")
        return (
            <SurfaceCard ariaLabel={p.loadingText}>
                <Text size="sm" tone="muted" live="polite">
                    {p.loadingText}
                </Text>
            </SurfaceCard>
        )
    return renderSettingsForm({ copy, p, on, props, values, off })
}

/** Inputs needed to build the publicTitle section. */
interface RenderPublicProgramPageContext {
    readonly copy: ProgramCopy
    readonly values: ProgramValues
    readonly off: boolean
    readonly on: LoyaltyProgramSettingsBaseProps["on"]
    readonly p: LoyaltyProgramSettingsBaseProps["props"]
}
/** Builds the publicTitle section from the current view. */
const renderPublicProgramPage = ({ copy, values, off, on, p }: RenderPublicProgramPageContext) => (
    <LoyaltySettingsSection title={copy.publicTitle} hint={copy.publicHint}>
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
                variant="secondary"
                value={p.link}
                isReadOnly
                isCopyable
                copyLabel={copy.copy}
                copiedLabel={copy.copied}
            />
        )}
    </LoyaltySettingsSection>
)

/** Inputs needed to build the expiryTitle section. */
interface RenderPointsExpiryContext {
    readonly copy: ProgramCopy
    readonly values: ProgramValues
    readonly off: boolean
    readonly on: LoyaltyProgramSettingsBaseProps["on"]
}
/** Builds the expiryTitle section from the current view. */
const renderPointsExpiry = ({ copy, values, off, on }: RenderPointsExpiryContext) => (
    <LoyaltySettingsSection title={copy.expiryTitle} hint={copy.expiryHint}>
        <div className={FIELD_PAIR_CLASS_NAME}>
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
        </div>
    </LoyaltySettingsSection>
)

/** Inputs needed to build the save section. */
interface RenderSettingsFormContext {
    readonly copy: ProgramCopy
    readonly p: LoyaltyProgramSettingsBaseProps["props"]
    readonly on: LoyaltyProgramSettingsBaseProps["on"]
    readonly props: LoyaltyProgramSettingsBaseProps
    readonly values: ProgramValues
    readonly off: boolean
}
/** Builds the save section from the current view. */
const renderSettingsForm = ({ copy, p, on, props, values, off }: RenderSettingsFormContext) => (
    <Form label={copy.save} isPending={p.isPending} onSubmit={on.submit}>
        <div className={FORM_CLASS_NAME}>
            {p.canEdit ? null : (
                <Text size="sm" tone="muted">
                    {copy.readOnlyNote}
                </Text>
            )}
            {renderEarningRules(props)}

            {renderTierRules(props)}

            {renderPointsExpiry({ copy, values, off, on })}

            <LoyaltyBirthdaySection
                title={copy.birthdayTitle}
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

            <LoyaltyPromoSection
                title={copy.promoTitle}
                hint={copy.promoHint}
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

            {renderPublicProgramPage({ copy, values, off, on, p })}

            {p.canEdit ? (
                <div className={ACTIONS_CLASS_NAME}>
                    <Button type="submit" variant="primary" isPending={p.isPending}>
                        {copy.save}
                    </Button>
                </div>
            ) : null}
        </div>
    </Form>
)

/** Inputs needed to build the LoyaltyProgramSettingsContent section. */
export interface BuildProgramCopyContext {
    readonly t: ReturnType<typeof useTranslations<"loyalty">>
}

/** Inputs needed to build the LoyaltyProgramSettingsContent section. */
export interface BuildProgramCommandsContext {
    readonly form: ReturnType<typeof useLoyaltyProgramForm>
    readonly touch: { shouldDirty: boolean; shouldValidate: boolean }
    readonly values: import("@/hooks/loyaltyProgram").ProgramValues
    readonly submit: (e?: React.BaseSyntheticEvent) => Promise<void>
}

/** Draws the category earning cards with their section controls. */
const renderEarningRules = (props: LoyaltyProgramSettingsBaseProps) => {
    const { props: p, on } = props
    const { copy, values } = p
    const off = !p.canEdit || p.isPending
    return (
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
    )
}

/** Draws the membership tier cards with their section controls. */
const renderTierRules = (props: LoyaltyProgramSettingsBaseProps) => {
    const { props: p, on } = props
    const { copy, values } = p
    const off = !p.canEdit || p.isPending
    return (
        <LoyaltyTierRules {...props}>
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
        </LoyaltyTierRules>
    )
}
