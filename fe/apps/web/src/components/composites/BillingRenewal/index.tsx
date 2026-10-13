import { Button } from "@starci/grammar/common"
import { RENEW_CLASS_NAME } from "./classNames"

interface BillingRenewalProps {
    readonly state: { readonly isRequesting: boolean }
    readonly props: { readonly label: string }
    readonly on: { readonly renew: () => void }
}

/** Draws the renewal action while its backend job is pending. */
export const BillingRenewal = (props: BillingRenewalProps) => (
    <div className={RENEW_CLASS_NAME}>
        <Button
            variant="primary"
            isPending={props.state.isRequesting}
            isDisabled={props.state.isRequesting}
            onPress={props.on.renew}
        >
            {props.props.label}
        </Button>
    </div>
)
