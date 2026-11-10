"use client"

import { useConnectionRefusal } from "@/hooks/connections"
import { useZaloStepViews } from "@/hooks/zaloConnection"
import { ZaloConnectionStepsBase } from "./component"

/** What the page hands the steps: the connection of the url. */
interface ZaloConnectionStepsProps {
    readonly connectionId: string
}

/** The connected setup of a Zalo OA connection: one joined list of five steps, each with its own body and its mark. */
export const ZaloConnectionSteps = (props: ZaloConnectionStepsProps) => {
    const views = useZaloStepViews(props.connectionId)
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <ZaloConnectionStepsBase
            props={{
                stepsLabel: views.stepsLabel,
                steps: views.steps,
                app: views.app,
                paste: views.paste,
                authorize: {
                    notice: views.authorize.notice,
                    ...(views.authorize.action === undefined ? {} : { action: views.authorize.action }),
                },
                checks: { ...views.checks },
                grants: views.grants.props,
            }}
            on={{
                ...views.on,
                removeGrant: views.grants.on.remove,
                assignGrant: views.grants.on.assign,
                retryGrants: views.grants.on.retry,
            }}
        />
    )
}
