import { Button, SurfaceCard } from "@starci/grammar/common"
import { LoyaltyField } from "@/components/leaves/LoyaltyField"
import type { TierTextField } from "@/hooks/loyaltyProgramFields"
import type { TierValues } from "@/hooks/loyaltyProgram"
import { FIELD_PAIR_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"

/** What one tier card of the programme settings draws and reports. */
type LoyaltyTierCardProps = {
    readonly tier: TierValues
    readonly isFirst: boolean
    readonly canRemove: boolean
    readonly isDisabled: boolean
    readonly isPending: boolean
    readonly nameError?: string | undefined
    readonly spendError?: string | undefined
    readonly nameLabel: string
    readonly spendLabel: string
    readonly firstHint: string
    readonly multiplierLabel: string
    readonly multiplierHint: string
    readonly winbackLabel: string
    readonly winbackHint: string
    readonly benefitLabel: string
    readonly removeLabel: string
    readonly onChange: (uid: string, field: TierTextField, value: string) => void
    readonly onRemove: (uid: string) => void
}

/** One tier: name, spend from, point multiplier, win-back days and benefit; the first tier always starts at 0 and cannot be removed. */
export const LoyaltyTierCard = (props: LoyaltyTierCardProps) => {
    const { tier } = props
    return (
        <SurfaceCard ariaLabel={tier.name || props.nameLabel}>
            <div className={FORM_CLASS_NAME}>
                <div className={FIELD_PAIR_CLASS_NAME}>
                    <LoyaltyField
                        id={`lp-tier-name-${tier.uid}`}
                        label={props.nameLabel}
                        value={tier.name}
                        error={props.nameError}
                        isDisabled={props.isDisabled}
                        onChange={(value) => props.onChange(tier.uid, "name", value)}
                    />
                    <LoyaltyField
                        id={`lp-tier-spend-${tier.uid}`}
                        label={props.spendLabel}
                        hint={props.isFirst ? props.firstHint : undefined}
                        value={props.isFirst ? "0" : tier.minSpend}
                        error={props.spendError}
                        isDisabled={props.isDisabled || props.isFirst}
                        onChange={(value) => props.onChange(tier.uid, "minSpend", value)}
                    />
                    <LoyaltyField
                        id={`lp-tier-mult-${tier.uid}`}
                        label={props.multiplierLabel}
                        hint={props.multiplierHint}
                        value={tier.multiplier}
                        isDisabled={props.isDisabled}
                        onChange={(value) => props.onChange(tier.uid, "multiplier", value)}
                    />
                    <LoyaltyField
                        id={`lp-tier-winback-${tier.uid}`}
                        label={props.winbackLabel}
                        hint={props.winbackHint}
                        value={tier.winback}
                        isDisabled={props.isDisabled}
                        onChange={(value) => props.onChange(tier.uid, "winback", value)}
                    />
                </div>
                <LoyaltyField
                    id={`lp-tier-benefit-${tier.uid}`}
                    label={props.benefitLabel}
                    value={tier.benefit}
                    isDisabled={props.isDisabled}
                    onChange={(value) => props.onChange(tier.uid, "benefit", value)}
                />
                {props.canRemove ? (
                    <div>
                        <Button
                            intent="destructive"
                            step="entry"
                            size="sm"
                            isDisabled={props.isPending}
                            onPress={() => props.onRemove(tier.uid)}
                        >
                            {props.removeLabel}
                        </Button>
                    </div>
                ) : null}
            </div>
        </SurfaceCard>
    )
}
