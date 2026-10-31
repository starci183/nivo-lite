import { SepayAgents } from "@/components/blocks/SepayAgents"
import { SepayChecklist } from "@/components/blocks/SepayChecklist"
import { SepayConsole } from "@/components/blocks/SepayConsole"
import { SepayEnvironmentPicker } from "@/components/blocks/SepayEnvironmentPicker"
import { SepayEvents } from "@/components/blocks/SepayEvents"
import { SepayHealth } from "@/components/blocks/SepayHealth"
import { SepaySetup } from "@/components/blocks/SepaySetup"
import { SepaySetupSteps } from "@/components/blocks/SepaySetupSteps"

/** What the SePay connection page supplies: the connection of the url and where the trail leads. */
export interface SepayConnectionPageBaseProps {
    readonly props: {
        readonly connectionId: string
        readonly homeHref: string
        readonly hubHref: string
    }
}

/**
 * Draws the page of one SePay connection as one page (no tabs): the frame owns the `Page`; its main pane holds the health tiles and
 * the five setup steps (environment, bank account, the webhook on SePay, the test, matching and the accounting agent); the live
 * webhook deliveries stand in the rail beside it.
 */
export const SepayConnectionPageBase = (props: SepayConnectionPageBaseProps) => {
    const id = props.props.connectionId
    return (
        <SepayConsole
            connectionId={id}
            homeHref={props.props.homeHref}
            hubHref={props.props.hubHref}
            shape={{
                main: (
                    <>
                        <SepayHealth connectionId={id} />
                        <SepaySetupSteps
                            connectionId={id}
                            shape={{
                                environment: <SepayEnvironmentPicker connectionId={id} />,
                                account: <SepaySetup connectionId={id} part="account" />,
                                paste: <SepaySetup connectionId={id} part="paste" />,
                                test: <SepayChecklist connectionId={id} />,
                                agents: <SepayAgents connectionId={id} />,
                            }}
                        />
                    </>
                ),
                rail: <SepayEvents connectionId={id} />,
            }}
        />
    )
}
