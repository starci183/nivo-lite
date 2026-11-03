import type { ReactNode } from "react"
import type { LoyaltyViews, LoyaltyActions } from "../types"
import { Button, Input, Text, Textarea, Stack } from "@starci/grammar/common"
/** Inputs and commands for the LoyaltyCampaignMessage presentation. */
type PromotionData = LoyaltyViews["promotion"]
interface LoyaltyCampaignMessageProps {
    readonly isLoading?: boolean
    readonly copy: Pick<PromotionData["copy"], "name" | "nameHint" | "brief" | "briefHint" | "submit" | "drafting">
    readonly values: Pick<PromotionData["values"], "name" | "brief">
    readonly briefError?: PromotionData["briefError"]
    readonly briefMax: number
    readonly isBusy: boolean
    readonly isDrafting: boolean
    readonly isSubmitDisabled: boolean
    readonly on: Pick<LoyaltyActions["promotion"], "setName" | "setBrief" | "submit">
}

/** Offer name and message fields, submission and drafting feedback. */
export const LoyaltyCampaignMessage = (props: LoyaltyCampaignMessageProps): ReactNode => {
    const { copy, values, briefError } = props
    const on = props.on
    return (
        <Stack gap="row">
            <Input
                id="promo-name"
                name="name"
                label={copy.name}
                description={copy.nameHint}
                value={values.name}
                isDisabled={props.isBusy}
                isLoading={props.isLoading ?? false}
                onValueChange={on.setName}
            />
            <Textarea
                label={copy.brief}
                description={copy.briefHint}
                errorMessage={briefError}
                rows={4}
                maxLength={props.briefMax}
                value={values.brief}
                isRequired
                isDisabled={props.isBusy}
                isLoading={props.isLoading ?? false}
                onValueChange={on.setBrief}
            />
            <div>
                <Button
                    intent="commit"
                    isPending={props.isBusy}
                    isLoading={props.isLoading ?? false}
                    isDisabled={props.isSubmitDisabled}
                    onPress={on.submit}
                >
                    {copy.submit}
                </Button>
            </div>
            {props.isDrafting ? (
                <Text size="sm" tone="muted" live="polite">
                    {copy.drafting}
                </Text>
            ) : null}
        </Stack>
    )
}
