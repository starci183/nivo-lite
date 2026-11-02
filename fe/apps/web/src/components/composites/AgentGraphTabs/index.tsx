import { Tabs } from "@starci/grammar/common"
import type { AgentGraphOptionView } from "@/modules/types"

/** The tabs of the pane beside the graph: chat, detail, proposals and versions. */
type AgentGraphTabsProps = {
    readonly label: string
    readonly tabs: ReadonlyArray<AgentGraphOptionView>
    readonly selected: string
    readonly onSelect: (value: string) => void
}

/** The region tabs of the side pane; selecting a node moves to Detail, so the pane never grows a third column. */
export const AgentGraphTabs = (props: AgentGraphTabsProps) => (
    <Tabs
        label={props.label}
        selectedKey={props.selected}
        items={props.tabs.map((tab) => ({ id: tab.value, label: tab.label }))}
        onSelect={props.onSelect}
    />
)
