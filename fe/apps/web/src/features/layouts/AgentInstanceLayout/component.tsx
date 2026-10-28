import type { ReactNode } from "react"
import { Divider, FillViewport, Page, SurfaceCard } from "@starci/grammar/common"
import { AgentInstanceHeader } from "@/components/blocks/AgentInstanceHeader"
import { AgentInstanceRail } from "@/components/blocks/AgentInstanceRail"
import type { ModuleKey } from "@/modules/catalog"
import { BODY, FRAME, MAIN, RAIL_COLUMN, SEPARATOR, SEPARATOR_VERTICAL } from "./classNames"

/** What the layout supplies: the type and the instance of the url. */
export interface AgentInstanceLayoutBaseProps {
    readonly props: { readonly module: ModuleKey; readonly installationId: string }
    /** The routed tab drawn inside the frame. */
    readonly children?: ReactNode
}

/** Draws the frame of an agent instance: the header band with the instance tabs, then the body `Page` holding one joined surface with the installed agents on the left and the routed tab. */
export const AgentInstanceLayoutBase = (props: AgentInstanceLayoutBaseProps) => (
    <>
        <AgentInstanceHeader module={props.props.module} installationId={props.props.installationId} />
        <Page measure="product">
            <FillViewport minHeight="md" bottomInset="page">
                <SurfaceCard ariaLabel={props.props.installationId} composition="joined" height="fill">
                    <div className={FRAME}>
                        <div className={RAIL_COLUMN}>
                            <AgentInstanceRail installationId={props.props.installationId} />
                        </div>
                        <div className={SEPARATOR}>
                            <Divider semantics="presentation" />
                        </div>
                        <div className={SEPARATOR_VERTICAL}>
                            <Divider orientation="vertical" semantics="presentation" />
                        </div>
                        <div className={MAIN}>
                            <div className={BODY}>{props.children}</div>
                        </div>
                    </div>
                </SurfaceCard>
            </FillViewport>
        </Page>
    </>
)
