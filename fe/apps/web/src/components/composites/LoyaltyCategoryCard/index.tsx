import { Button, SurfaceCard } from "@starci/grammar/common"
import { LoyaltyField } from "@/components/leaves/LoyaltyField"
import type { CategoryTextField, CategoryValues } from "@/modules/types"
import { FIELD_TRIPLE_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"

/** What one category rule card of the programme settings draws and reports. */
type LoyaltyCategoryCardProps = {
    readonly category: CategoryValues
    readonly canRemove: boolean
    readonly isDisabled: boolean
    readonly isPending: boolean
    readonly ariaLabel: string
    readonly matchLabel: string
    readonly rateLabel: string
    readonly labelLabel: string
    readonly removeLabel: string
    readonly onChange: (uid: string, field: CategoryTextField, value: string) => void
    readonly onRemove: (uid: string) => void
}

/** One earn rule for a category: the word to find in an order, its points per 1.000 and the group name. */
export const LoyaltyCategoryCard = (props: LoyaltyCategoryCardProps) => {
    const { category } = props
    return (
        <SurfaceCard ariaLabel={props.ariaLabel}>
            <div className={FORM_CLASS_NAME}>
                <div className={FIELD_TRIPLE_CLASS_NAME}>
                    <LoyaltyField
                        id={`lp-cat-match-${category.uid}`}
                        label={props.matchLabel}
                        value={category.match}
                        isDisabled={props.isDisabled}
                        onChange={(value) => props.onChange(category.uid, "match", value)}
                    />
                    <LoyaltyField
                        id={`lp-cat-rate-${category.uid}`}
                        label={props.rateLabel}
                        value={category.rate}
                        isDisabled={props.isDisabled}
                        onChange={(value) => props.onChange(category.uid, "rate", value)}
                    />
                    <LoyaltyField
                        id={`lp-cat-label-${category.uid}`}
                        label={props.labelLabel}
                        value={category.label}
                        isDisabled={props.isDisabled}
                        onChange={(value) => props.onChange(category.uid, "label", value)}
                    />
                </div>
                {props.canRemove ? (
                    <div>
                        <Button
                            intent="destructive"
                            step="entry"
                            size="sm"
                            isDisabled={props.isPending}
                            onPress={() => props.onRemove(category.uid)}
                        >
                            {props.removeLabel}
                        </Button>
                    </div>
                ) : null}
            </div>
        </SurfaceCard>
    )
}
