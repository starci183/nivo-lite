import { Button } from "@starci/grammar/common"
import { RENEW_CLASS_NAME } from "./classNames"

interface BillingRenewalProps {
    readonly props: { readonly label: string; readonly isPending: boolean }
    readonly on: { readonly renew: () => void }
}

/** Draws the renewal action while its backend job is pending. */
export const BillingRenewal = (props: BillingRenewalProps) => (
    <div className={RENEW_CLASS_NAME}>
        <Button
            intent="commit"
            isPending={props.props.isPending}
            isDisabled={props.props.isPending}
            onPress={props.on.renew}
        >
            {props.props.label}
        </Button>
    </div>
)
