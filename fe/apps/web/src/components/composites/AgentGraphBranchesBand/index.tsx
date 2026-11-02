import { AgentGraphBranches } from "@/components/branches/AgentGraphBranches"
import { AgentGraphAdder } from "@/components/branches/AgentGraphAdder"
import type { AgentGraphAction, AgentGraphPanelView } from "@/modules/types"

/** Ready branch sentences and the native add-point controls of the phone lane. */
interface AgentGraphBranchesBandProps {
    readonly branches: AgentGraphPanelView["branches"]
    readonly adder: AgentGraphPanelView["adder"]
    readonly isLoading: boolean
    readonly onAction: (action: AgentGraphAction) => void
}

/** Keeps the existing branch list before its add-point controls, without a read or a wrapper. */
export const AgentGraphBranchesBand = (props: AgentGraphBranchesBandProps) => (
    <>
        <AgentGraphBranches
            view={props.branches}
            isLoading={props.isLoading}
            onOpen={(value) => props.onAction({ kind: "openNode", value })}
        />
        <AgentGraphAdder
            view={props.adder}
            isLoading={props.isLoading}
            onPick={(field, value) => props.onAction({ kind: "adderPick", field, value })}
            onAdd={(action, fact) => props.onAction({ kind: "addDecide", action, fact })}
        />
    </>
)
