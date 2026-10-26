import { Checkbox, NumberField, Text } from "@starci/grammar/common"
import { DividedRow } from "@/components/leaves/DividedRow"
import { GRANT_LIST_CLASS_NAME, GRANT_ROW_CLASS_NAME, SECTION_CLASS_NAME } from "./classNames"

const WHOLE = { maximumFractionDigits: 2 }

/** The words and state of the approval limits. */
export interface PermissionGrantsFieldsProps {
    readonly props: {
        readonly grants: ReadonlyArray<{
            readonly memberId: string
            readonly name: string
            readonly enabled: boolean
            readonly max: number
            /** The accessible name of the limit field of this member. */
            readonly maxLabel: string
        }>
        /** Only the owner hands out approval limits. */
        readonly canGrant: boolean
        readonly copy: {
            readonly grantsLabel: string
            readonly grantsNote: string
            readonly ownerAlways: string
        }
    }
    readonly on: {
        readonly enabled: (memberId: string, enabled: boolean) => void
        readonly max: (memberId: string, max: number) => void
    }
}

/** The members who may approve this rule and the largest amount each may approve. */
export const PermissionGrantsFields = (props: PermissionGrantsFieldsProps) => {
    const { props: p, on } = props
    return (
        <div className={SECTION_CLASS_NAME}>
            <Text weight="semibold">{p.copy.grantsLabel}</Text>
            <Text size="sm" tone="muted">
                {p.copy.grantsNote}
            </Text>
            <div className={GRANT_LIST_CLASS_NAME}>
                {p.grants.map((grant, index) => (
                    <DividedRow key={grant.memberId} isFirst={index === 0}>
                        <div className={GRANT_ROW_CLASS_NAME}>
                            <Checkbox
                                label={grant.name}
                                isDisabled={!p.canGrant}
                                isSelected={grant.enabled}
                                onSelectedChange={(enabled) => on.enabled(grant.memberId, enabled)}
                            />
                            <NumberField
                                label={grant.maxLabel}
                                isLabelHidden
                                minValue={0}
                                formatOptions={WHOLE}
                                isDisabled={!p.canGrant || !grant.enabled}
                                value={grant.max}
                                onValueChange={(value) => on.max(grant.memberId, value)}
                            />
                        </div>
                    </DividedRow>
                ))}
            </div>
            <Text size="xs" tone="muted">
                {p.copy.ownerAlways}
            </Text>
        </div>
    )
}
