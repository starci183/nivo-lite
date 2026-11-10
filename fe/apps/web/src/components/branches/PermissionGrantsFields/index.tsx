import { Checkbox, NumberField, Text, Grid, Stack, Section } from "@starci/grammar/common"
const WHOLE = { maximumFractionDigits: 2 }

/** The words and state of the approval limits. */
export interface PermissionGrantsFieldsProps {
    readonly isLoading?: boolean
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
        <Section
            title={p.copy.grantsLabel}
            headingLevel={3}
            isLoading={props.isLoading === true}
        >
            <Stack gap="row">
                {p.grants.map((grant) => (
                    <Grid key={grant.memberId} kind="form" columns={2}>
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
                    </Grid>
                ))}
            </Stack>
            <Text size="xs" tone="muted">
                {`${p.copy.grantsNote} ${p.copy.ownerAlways}`}
            </Text>
        </Section>
    )
}
