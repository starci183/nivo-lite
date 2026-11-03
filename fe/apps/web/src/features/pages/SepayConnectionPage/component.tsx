import { SepayAgents } from "@/components/blocks/SepayAgents"
import { SepayChecklist } from "@/components/blocks/SepayChecklist"
import { SepayConsole } from "@/components/blocks/SepayConsole"
import { SepayEnvironmentPicker } from "@/components/blocks/SepayEnvironmentPicker"
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
 * Draws the page of one SePay connection as one page (no tabs): the frame owns the `Page`; its main pane holds the health tiles, the
 * stepper and the five setup steps (environment, bank account, the webhook on SePay, the test, matching and the accounting agent);
 * the live webhook deliveries stand in the rail beside it.
 */
export const SepayConnectionPageBase = (props: SepayConnectionPageBaseProps) => {
    const id = props.props.connectionId
    return (
        <SepayConsole connectionId={id} homeHref={props.props.homeHref} hubHref={props.props.hubHref}>
            <SepayHealth connectionId={id} />
            <SepaySetupSteps connectionId={id} />
            <SepayEnvironmentPicker connectionId={id} />
            <SepaySetup connectionId={id} part="account" />
            <SepaySetup connectionId={id} part="paste" />
            <SepayChecklist connectionId={id} />
            <SepayAgents connectionId={id} />
        </SepayConsole>
    )
}
