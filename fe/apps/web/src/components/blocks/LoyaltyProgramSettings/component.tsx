import { Alert, Button, Form, Heading, Input, Select, SurfaceCard, Switch, Text } from "@starci/grammar/common"
import { LoyaltyBirthdaySection } from "@/components/composites/LoyaltyBirthdaySection"
import { LoyaltyCategoryCard } from "@/components/composites/LoyaltyCategoryCard"
import { LoyaltyPromoSection } from "@/components/composites/LoyaltyPromoSection"
import { LoyaltyField } from "@/components/leaves/LoyaltyField"
import { LoyaltySettingsSection } from "@/components/leaves/LoyaltySettingsSection"
import { LoyaltyTierCard } from "@/components/composites/LoyaltyTierCard"
import type { ProgramValues } from "@/hooks/loyaltyProgram"
import type {
    CategoryTextField,
    ProgramSwitchField,
    ProgramTextField,
    TierTextField,
} from "@/hooks/loyaltyProgramFields"
import type { ProgramCopy, TierErrorView } from "./types"
import { ACTIONS_CLASS_NAME, FIELD_PAIR_CLASS_NAME, FIELD_TRIPLE_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"

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
            readonly name?: string
            readonly tiers?: string
            readonly hourFrom?: string
            readonly hourTo?: string
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
    return (
        <Form label={copy.save} isPending={p.isPending} onSubmit={on.submit}>
            <div className={FORM_CLASS_NAME}>
                {p.canEdit ? null : (
                    <Text size="sm" tone="muted">
                        {copy.readOnlyNote}
                    </Text>
                )}
                <LoyaltySettingsSection title={copy.earnTitle} hint={copy.earnHint}>
                    <LoyaltyField
                        id="lp-name"
                        label={copy.name}
                        value={values.name}
                        error={p.errors.name}
                        isDisabled={off}
                        onChange={(value) => on.change("name", value)}
                    />
                    <div className={FIELD_TRIPLE_CLASS_NAME}>
                        <LoyaltyField
                            id="lp-per-thousand"
                            label={copy.perThousand}
                            hint={copy.perThousandHint}
                            value={values.perThousand}
                            isDisabled={off}
                            onChange={(value) => on.change("perThousand", value)}
                        />
                        <LoyaltyField
                            id="lp-per-visit"
                            label={copy.perVisit}
                            value={values.perVisit}
                            isDisabled={off}
                            onChange={(value) => on.change("perVisit", value)}
                        />
                        <LoyaltyField
                            id="lp-min-order"
                            label={copy.minOrder}
                            hint={copy.minOrderHint}
                            value={values.minOrder}
                            isDisabled={off}
                            onChange={(value) => on.change("minOrder", value)}
                        />
                    </div>
                    <Select
                        label={copy.trigger}
                        variant="secondary"
                        description={copy.triggerHint}
                        options={p.triggerOptions}
                        value={values.trigger}
                        isDisabled={off}
                        onValueChange={(value) => on.change("trigger", value ?? "")}
                    />
                    <Heading level={3}>{copy.categories}</Heading>
                    <Text size="sm" tone="muted">
                        {copy.categoriesHint}
                    </Text>
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
                    {p.canEdit && p.canAddCategory ? (
                        <div>
                            <Button variant="outline" size="sm" isDisabled={p.isPending} onPress={on.addCategory}>
                                {copy.addCategory}
                            </Button>
                        </div>
                    ) : null}
                </LoyaltySettingsSection>

                <LoyaltySettingsSection title={copy.tiersTitle} hint={copy.tiersHint}>
                    {p.errors.tiers === undefined ? null : <Alert tone="negative" title={p.errors.tiers} />}
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
                    {p.canEdit && p.canAddTier ? (
                        <div>
                            <Button variant="outline" size="sm" isDisabled={p.isPending} onPress={on.addTier}>
                                {copy.addTier}
                            </Button>
                        </div>
                    ) : null}
                </LoyaltySettingsSection>

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
}
