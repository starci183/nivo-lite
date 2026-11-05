import { Tabs } from "@starci/grammar/common"

/** The two panes a phone chooses between on the Work tab. */
interface AgentWorkPhoneTabsProps {
    readonly label: string
    readonly workLabel: string
    readonly goalsLabel: string
    readonly selected: "work" | "goals"
    readonly onSelect: (view: "work" | "goals") => void
}

/** The tab line that switches the phone between the work and the goals with the schedule. */
export const AgentWorkPhoneTabs = (props: AgentWorkPhoneTabsProps) => (
    <Tabs
        label={props.label}
        selectedKey={props.selected}
        items={[
            { id: "work", label: props.workLabel },
            { id: "goals", label: props.goalsLabel },
        ]}
        onSelect={(view) => props.onSelect(view === "goals" ? "goals" : "work")}
    />
)
