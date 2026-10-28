import { SepayAgents } from "@/components/blocks/SepayAgents"
import { SepayChecklist } from "@/components/blocks/SepayChecklist"
import { SepayConsole } from "@/components/blocks/SepayConsole"
import { SepayEvents } from "@/components/blocks/SepayEvents"
import { SepayHealth } from "@/components/blocks/SepayHealth"
import { SepayOverview } from "@/components/blocks/SepayOverview"
import { SepaySetup } from "@/components/blocks/SepaySetup"

/** What the SePay connection page supplies: the connection of the url and where the trail leads. */
export interface SepayConnectionPageBaseProps {
    readonly props: {
        readonly connectionId: string
        /** The `?tab=` of the url when it named one. */
        readonly tab: string | undefined
        readonly homeHref: string
        readonly hubHref: string
    }
}

/** Draws the page of one SePay connection: header, Overview / Setup / Test / Agents tabs and the live event panel. */
export const SepayConnectionPageBase = (props: SepayConnectionPageBaseProps) => {
    const id = props.props.connectionId
    return (
        <SepayConsole
            connectionId={id}
            tab={props.props.tab}
            homeHref={props.props.homeHref}
            hubHref={props.props.hubHref}
            shape={{
                overview: <SepayOverview connectionId={id} />,
                setup: <SepaySetup connectionId={id} />,
                test: (
                    <>
                        <SepayChecklist connectionId={id} />
                        <SepayHealth connectionId={id} />
                    </>
                ),
                agents: <SepayAgents connectionId={id} />,
                events: <SepayEvents connectionId={id} />,
            }}
        />
    )
}
