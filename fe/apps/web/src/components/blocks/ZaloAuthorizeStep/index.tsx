"use client"

import { useConnectionRefusal } from "@/hooks/connections"
import { useZaloSetupStep } from "@/hooks/zaloConnection"
import { ZaloAuthorizeStepBase } from "./component"

/** What the page hands the step: the connection of the url. */
interface ZaloAuthorizeStepProps {
    readonly connectionId: string
}

/** The connected authorization step: done or not from the page read, with the command that sends the owner to Zalo. */
export const ZaloAuthorizeStep = (props: ZaloAuthorizeStepProps) => {
    const setup = useZaloSetupStep(props.connectionId, "authorize")
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <ZaloAuthorizeStepBase
            props={{
                step: setup.step,
                notice: setup.authorizeNotice,
                ...(setup.authorize === undefined ? {} : { authorize: setup.authorize }),
            }}
            on={{ toggle: setup.toggle, authorize: setup.runAuthorize }}
        />
    )
}
