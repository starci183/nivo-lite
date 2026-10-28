import type { ReactNode } from "react"
import { Tabs } from "@starci/grammar/common"
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
    readonly props: {
        readonly tabsLabel: string
        readonly tabs: ReadonlyArray<{
            readonly id: SepayTabId
            readonly label: string
        }>
        readonly selected: string
    }
    readonly on: { readonly select: (id: string) => void }
}

/** Draws the page anatomy of a connection: the header, the four tabs, and the live event panel docked on the right. */
export const SepayConsoleBase = (props: SepayConsoleBaseProps) => {
    const current = props.props.tabs.find((tab) => tab.id === props.props.selected) ?? props.props.tabs[0]
    return (
        <div className={classNames.page}>
            {props.shape.header}
            <div className={classNames.grid}>
                <div className={classNames.main}>
                    <Tabs
                        variant="primary"
                        label={props.props.tabsLabel}
                        selectedKey={current?.id ?? ""}
                        items={props.props.tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
                        inset="none"
                        labelVisibility="always"
                        panelId={(id) => `sepay-panel-${id}`}
                        onSelect={props.on.select}
                    />
                    <div className={classNames.panel} role="tabpanel" id={`sepay-panel-${current?.id ?? ""}`}>
                        {current === undefined ? null : props.shape[current.id]}
                    </div>
                </div>
                <aside>{props.shape.events}</aside>
            </div>
        </div>
    )
}
