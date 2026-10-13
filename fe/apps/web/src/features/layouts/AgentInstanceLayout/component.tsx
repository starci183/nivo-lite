import type { ReactNode } from "react"
import { PageContainer, PrimaryRailLayout } from "@starci/grammar/common"
import { AgentInstanceHeader } from "@/components/blocks/AgentInstanceHeader"
import { AgentInstanceRail } from "@/components/blocks/AgentInstanceRail"
import { AgentTabs } from "@/components/blocks/AgentTabs"
import type { ModuleKey } from "@/modules/catalog"
import { MAIN } from "./classNames"

/** What the layout supplies: the type and the instance of the url. */
export interface AgentInstanceLayoutBaseProps {
    readonly props: { readonly module: ModuleKey; readonly installationId: string }
    /** The routed tab drawn inside the frame. */
    readonly children?: ReactNode
}

/** Draws the frame of an agent instance: the installed agents on the left, its header and tabs, and the routed tab below. */
export const AgentInstanceLayoutBase = (props: AgentInstanceLayoutBaseProps) => (
    <PageContainer measure="product">
        <PrimaryRailLayout
            railPosition="leading"
            railWidth="compact"
            align="start"
            collapsedOrder="rail-first"
            rail={<AgentInstanceRail installationId={props.props.installationId} />}
            primary={
                <div className={MAIN}>
                    <AgentInstanceHeader module={props.props.module} installationId={props.props.installationId} />
                    <AgentTabs module={props.props.module} installationId={props.props.installationId} />
                    {props.children}
                </div>
            }
        />
    </PageContainer>
)
