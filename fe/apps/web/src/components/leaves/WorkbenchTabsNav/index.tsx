import { Tabs } from "@starci/grammar/common"

/** One tab of a workbench. */
interface WorkbenchTabItem {
    readonly id: string
    readonly label: string
}

/** What the tab strip of a workbench draws. */
interface WorkbenchTabsNavProps {
    readonly label: string
    readonly items: ReadonlyArray<WorkbenchTabItem>
    readonly selected: string
    readonly onSelect: (id: string) => void
}

/** The id of the panel a tab controls. */
export const workbenchPanelId = (id: string): string => `agent-dashboard-panel-${id}`

/** The tab strip of a workbench; the panel of the selected tab is drawn below it by the page. */
export const WorkbenchTabsNav = (props: WorkbenchTabsNavProps) => (
    <Tabs
        variant="primary"
        label={props.label}
        selectedKey={props.selected}
        items={props.items.map(({ id, label }) => ({ id, label }))}
        inset="none"
        labelVisibility="always"
        panelId={workbenchPanelId}
        onSelect={props.onSelect}
    />
)
