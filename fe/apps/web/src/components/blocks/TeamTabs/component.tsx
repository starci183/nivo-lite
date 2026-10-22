import { Tabs } from "@starci/grammar/common"

/** Copy, state and command of the tabs that sit over the team and the permissions pages. */
export interface TeamTabsBaseProps {
    readonly props: {
        readonly label: string
        readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly selected: string
    }
    readonly on: { readonly select: (id: string) => void }
}

/** Draws the Thanh vien and Quyen tabs: two views of who works in the workspace and what each person may approve. */
export const TeamTabsBase = (props: TeamTabsBaseProps) => (
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
