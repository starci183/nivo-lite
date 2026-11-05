import type { ReactNode } from "react"
import { Grid } from "@starci/grammar/common"
import { LoyaltyField } from "./LoyaltyField"
import type { ProgramTextField } from "../types"
/** What the promotion limits section of the programme settings draws and reports. */
type LoyaltyPromoSectionProps = {
    readonly maxPerMonth: string
    readonly batch: string
    readonly hourFrom: string
    readonly hourTo: string
    readonly hourFromError?: string | undefined
    readonly hourToError?: string | undefined
    readonly isDisabled: boolean
    readonly maxPerMonthLabel: string
    readonly batchLabel: string
    readonly batchHint: string
    readonly hourFromLabel: string
    readonly hourToLabel: string
    readonly onChange: (field: ProgramTextField, value: string) => void
}

/** The limits of promotion messages: how many a customer gets, how many go out a minute and between which hours. */
export const LoyaltyPromoSection = (props: LoyaltyPromoSectionProps): ReactNode => (
    <>
        <Grid kind="form" columns={2}>
            <LoyaltyField
                id="lp-max-month"
                label={props.maxPerMonthLabel}
                value={props.maxPerMonth}
                isDisabled={props.isDisabled}
                onChange={(value) => props.onChange("maxPerMonth", value)}
            />
            <LoyaltyField
                id="lp-batch"
                label={props.batchLabel}
                hint={props.batchHint}
                value={props.batch}
                isDisabled={props.isDisabled}
                onChange={(value) => props.onChange("batch", value)}
            />
            <LoyaltyField
                id="lp-hour-from"
                label={props.hourFromLabel}
                placeholder="08:00"
                value={props.hourFrom}
                error={props.hourFromError}
                isDisabled={props.isDisabled}
                onChange={(value) => props.onChange("hourFrom", value)}
            />
            <LoyaltyField
                id="lp-hour-to"
                label={props.hourToLabel}
                placeholder="21:00"
                value={props.hourTo}
                error={props.hourToError}
                isDisabled={props.isDisabled}
                onChange={(value) => props.onChange("hourTo", value)}
            />
        </Grid>
    </>
)
