import { Drawer } from "@starci/grammar/common"
import { AgentGraphInspector } from "@/components/composites/AgentGraphInspector"
import type { AgentGraphAction, AgentGraphPanelView } from "@/modules/types"

/** Ready node detail and its existing close command, already resolved by the block. */
interface AgentGraphDetailDrawerProps {
    readonly view: AgentGraphPanelView
    readonly isLoading: boolean
    readonly onAction: (action: AgentGraphAction) => void
}

/** The phone detail drawer keeps the same inspector, title, open state and close action. */
export const AgentGraphDetailDrawer = (props: AgentGraphDetailDrawerProps) => (
    <Drawer
        title={props.view.drawerTitle}
        isOpen={props.view.isDrawerOpen}
        onOpenChange={() => props.onAction({ kind: "closeDrawer" })}
    >
        <AgentGraphInspector view={props.view} sideTab="detail" isLoading={props.isLoading} onAction={props.onAction} />
    </Drawer>
)
