import { Button, Stack } from "@starci/grammar/common"

interface BillingRenewalProps {
    readonly props: { readonly label: string; readonly isPending: boolean }
    readonly on: { readonly renew: () => void }
}

/** Draws the renewal action while its backend job is pending. */
export const BillingRenewal = (props: BillingRenewalProps) => (
    <Stack gap="row" align="start">
        <Button
            intent="commit"
            isPending={props.props.isPending}
            isDisabled={props.props.isPending}
            onPress={props.on.renew}
        >
            {props.props.label}
        </Button>
    </Stack>
)
