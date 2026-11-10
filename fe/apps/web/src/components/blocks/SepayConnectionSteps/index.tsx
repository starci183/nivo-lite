"use client"

import { useConnectionRefusal } from "@/hooks/connections"
import { useSepayStepViews } from "@/hooks/sepayConnection"
import { SepayConnectionStepsBase } from "./component"

/** What the page hands the steps: the connection of the url. */
type SepayConnectionStepsProps = { readonly connectionId: string }

/** The connected setup of a SePay connection: one joined list of five steps, each with its own body and its mark. */
export const SepayConnectionSteps = (props: SepayConnectionStepsProps) => {
    const views = useSepayStepViews(props.connectionId)
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <SepayConnectionStepsBase
            props={{
                stepsLabel: views.stepsLabel,
                steps: views.steps,
                environment: views.environment,
                account: views.account,
                paste: views.paste,
                openSepay: views.openSepay,
                checklist: views.checklist,
                matching: views.matching,
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
