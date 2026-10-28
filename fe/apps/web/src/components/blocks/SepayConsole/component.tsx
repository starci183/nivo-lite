import type { ReactNode } from "react"
import { PageContainer } from "@starci/grammar/common"
import { sepayConsoleClassNames as classNames } from "./classNames"

/** The connected regions the page places. */
export interface SepayConsoleShape {
    readonly header: ReactNode
    readonly overview: ReactNode
    readonly setup: ReactNode
    readonly test: ReactNode
    readonly agents: ReactNode
    readonly events: ReactNode
}

/** The tabs of the page, in order. */
export type SepayTabId = "overview" | "setup" | "test" | "agents"

/** Props for {@link SepayConsoleBase}. */
export interface SepayConsoleBaseProps {
    readonly shape: SepayConsoleShape
    readonly props: { readonly selected: SepayTabId }
}

/** Draws the page anatomy of a connection: the header band, then the open tab's region with the live event panel docked beside it. */
export const SepayConsoleBase = (props: SepayConsoleBaseProps) => (
    <>
        {props.shape.header}
        <PageContainer measure="product">
            <div className={classNames.frame}>
                <div className={classNames.main} role="tabpanel" id={`sepay-panel-${props.props.selected}`}>
                    {props.shape[props.props.selected]}
                </div>
                <aside className={classNames.aside}>{props.shape.events}</aside>
            </div>
        </PageContainer>
    </>
)
