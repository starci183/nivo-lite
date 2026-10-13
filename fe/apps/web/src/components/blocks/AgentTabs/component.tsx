import { Tabs } from "@starci/grammar/common"

/** Copy, state and command of the tabs of an agent. */
export interface AgentTabsBaseProps {
    readonly props: {
        readonly label: string
        readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly selected: string
    }
    readonly on: { readonly select: (id: string) => void }
}

/** Draws the Setup, Workbench and Settings tabs of an agent. */
export const AgentTabsBase = (props: AgentTabsBaseProps) => (
    <Tabs
        variant="primary"
        label={props.props.label}
        selectedKey={props.props.selected}
        inset="none"
        labelVisibility="always"
        items={props.props.tabs}
        onSelect={props.on.select}
    />
)
