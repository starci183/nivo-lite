import { Alert, Button } from "@starci/grammar/common"
import { ConnectionStepBand } from "@/components/frames/ConnectionStepBand"

/** Copy and commands of the third setup step: granting the OA to NIVO on Zalo. */
export interface ZaloAuthorizeStepBaseProps {
    readonly props: {
        /** The step's band: its place, words and whether it is open. */
        readonly step: {
            readonly ordinal: number
            readonly title: string
            readonly summary: string
            readonly hint: string
            readonly isOpen: boolean
        }
        /** Why the last authorization did not start, worded by the back end; empty when there is none. */
        readonly notice: string
        /** Sends the owner to Zalo to grant the OA; absent for everyone else, whom the back end refuses. */
        readonly authorize?: {
            readonly label: string
            readonly isPending: boolean
            /** The OA is not authorized yet: granting it is the page's next step, its one commit (CTA-1). */
            readonly isNext: boolean
        }
    }
    readonly on: {
        readonly toggle: (isOpen: boolean) => void
        readonly authorize: () => void
    }
}

/** Draws the authorization step: its guidance, the command that sends the owner to Zalo, and why the last attempt did not start. */
export const ZaloAuthorizeStepBase = (props: ZaloAuthorizeStepBaseProps) => {
    const { authorize, notice } = props.props
    return (
        <ConnectionStepBand
            {...props.props.step}
            onToggle={props.on.toggle}
            actions={
                authorize === undefined ? undefined : (
                    <Button
                        intent={authorize.isNext ? "commit" : "neutral"}
                        isPending={authorize.isPending}
                        onPress={props.on.authorize}
                    >
                        {authorize.label}
                    </Button>
                )
            }
        >
            {notice === "" ? null : <Alert tone="negative" appearance="soft" title={notice} />}
        </ConnectionStepBand>
    )
}
