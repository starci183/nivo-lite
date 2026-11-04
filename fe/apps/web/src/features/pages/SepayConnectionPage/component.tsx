import { ConnectionGrants } from "@/components/blocks/ConnectionGrants"
import { SepayAgents } from "@/components/blocks/SepayAgents"
import { SepayChecklist } from "@/components/blocks/SepayChecklist"
import { SepayConsole } from "@/components/blocks/SepayConsole"
import { SepayEnvironmentPicker } from "@/components/blocks/SepayEnvironmentPicker"
import { SepayHealth } from "@/components/blocks/SepayHealth"
import { SepayNotices } from "@/components/blocks/SepayNotices"
import { SepayRail } from "@/components/blocks/SepayRail"
import { SepaySetup } from "@/components/blocks/SepaySetup"
import { SepaySetupSteps } from "@/components/blocks/SepaySetupSteps"
import { ConnectionPaneFrame } from "@/components/frames/ConnectionPaneFrame"

/** What the SePay connection page supplies: the connection of the url, where the back control leads, and the words of its panes. */
export interface SepayConnectionPageBaseProps {
    readonly props: {
        readonly connectionId: string
        readonly hubHref: string
        readonly gridLabel: string
        readonly mainLabel: string
        readonly rail: { readonly label: string; readonly openLabel: string; readonly closeLabel: string }
    }
}

/**
 * Draws the page of one SePay connection inside the Connections frame: the head band, the health tiles, the stepper and the five
 * setup steps (environment, bank account, the webhook on SePay, the test, matching and the accounting agent) and the agents with
 * their levels; the live webhook deliveries stand in the rail beside it.
 */
export const SepayConnectionPageBase = (props: SepayConnectionPageBaseProps) => {
    const id = props.props.connectionId
    return (
        <ConnectionPaneFrame
            gridLabel={props.props.gridLabel}
            mainLabel={props.props.mainLabel}
            rail={props.props.rail}
            head={<SepayConsole connectionId={id} hubHref={props.props.hubHref} />}
            aside={<SepayRail connectionId={id} />}
        >
            <SepayNotices connectionId={id} hubHref={props.props.hubHref} />
            <SepayHealth connectionId={id} />
            <SepaySetupSteps connectionId={id} />
            <SepayEnvironmentPicker connectionId={id} />
            <SepaySetup connectionId={id} part="account" />
            <SepaySetup connectionId={id} part="paste" />
            <SepayChecklist connectionId={id} />
            <SepayAgents connectionId={id} />
            <ConnectionGrants connectionId={id} />
        </ConnectionPaneFrame>
    )
}
