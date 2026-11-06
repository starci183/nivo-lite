import { Tabs } from "@starci/grammar/common"

/** Copy and the chosen view of the Work tab line. */
export interface AgentWorkTabsBaseProps {
    readonly props: {
        readonly label: string
        readonly workLabel: string
        readonly runsLabel: string
        readonly selected: "work" | "runs"
    }
    readonly on: { readonly select: (view: "work" | "runs") => void }
}

/** The line that switches the Work tab between the work and the runs of the agent. */
export const AgentWorkTabsBase = (props: AgentWorkTabsBaseProps) => (
    <Tabs
        label={props.props.label}
        selectedKey={props.props.selected}
        items={[
            { id: "work", label: props.props.workLabel },
            { id: "runs", label: props.props.runsLabel },
        ]}
        onSelect={(view) => props.on.select(view === "runs" ? "runs" : "work")}
    />
)
