import { AgentDashboardFrame } from "@/components/blocks/AgentDashboardFrame"
import { ShiftsAvailability } from "@/components/blocks/ShiftsAvailability"
import { ShiftsCoverage } from "@/components/blocks/ShiftsCoverage"
import { ShiftsDemand } from "@/components/blocks/ShiftsDemand"
import { ShiftsFigures } from "@/components/blocks/ShiftsFigures"
import { ShiftsGrid } from "@/components/blocks/ShiftsGrid"
import { ShiftsLeave } from "@/components/blocks/ShiftsLeave"
import { ShiftsMyAvailability } from "@/components/blocks/ShiftsMyAvailability"
import { ShiftsMyShifts } from "@/components/blocks/ShiftsMyShifts"
import { ShiftsMySwaps } from "@/components/blocks/ShiftsMySwaps"
import { ShiftsOpenShifts } from "@/components/blocks/ShiftsOpenShifts"
import { ShiftsPositions } from "@/components/blocks/ShiftsPositions"
import { ShiftsQuickImport } from "@/components/blocks/ShiftsQuickImport"
import { ShiftsRequests } from "@/components/blocks/ShiftsRequests"
import { ShiftsRules } from "@/components/blocks/ShiftsRules"
import { ShiftsStaff } from "@/components/blocks/ShiftsStaff"
import { ShiftsWeekBar } from "@/components/blocks/ShiftsWeekBar"
import { ShiftsWeekStats } from "@/components/blocks/ShiftsWeekStats"
import { PANEL_CLASS_NAME } from "./classNames"

/** Copy the server shell supplies: the route's tab and installation, the tab names and the four ribbon terms. */
export interface ShiftsWorkbenchPageBaseProps {
    readonly props: {
        readonly installationId: string | null
        readonly initialTab: string | null
        readonly tabs: {
            readonly week: string
            readonly requests: string
            readonly setup: string
            readonly quick: string
            readonly mine: string
        }
        readonly terms: ReadonlyArray<string>
    }
}

/**
 * Draws the Shifts workbench: the agent dashboard frame around the week, requests, setup, quick import and my-schedule tabs. Every
 * tab block reads its own data; the ribbon shows the terms here and the real figures in the connected strip at the top of the first tab.
 */
export const ShiftsWorkbenchPageBase = (props: ShiftsWorkbenchPageBaseProps) => (
    <AgentDashboardFrame
        module="shifts"
        installationId={props.props.installationId}
        initialTab={props.props.initialTab}
        figures={props.props.terms.map((term) => ({ id: term, term, description: "-" }))}
        tabs={[
            {
                id: "week",
                label: props.props.tabs.week,
                content: (
                    <div className={PANEL_CLASS_NAME}>
                        <ShiftsFigures />
                        <ShiftsWeekBar />
                        <ShiftsWeekStats />
                        <ShiftsCoverage />
                        <ShiftsGrid />
                    </div>
                ),
            },
            { id: "requests", label: props.props.tabs.requests, content: <ShiftsRequests /> },
            {
                id: "setup",
                label: props.props.tabs.setup,
                content: (
                    <div className={PANEL_CLASS_NAME}>
                        <ShiftsPositions />
                        <ShiftsStaff />
                        <ShiftsDemand />
                        <ShiftsAvailability />
                        <ShiftsRules />
                    </div>
                ),
            },
            { id: "quick", label: props.props.tabs.quick, content: <ShiftsQuickImport /> },
            {
                id: "mine",
                label: props.props.tabs.mine,
                content: (
                    <div className={PANEL_CLASS_NAME}>
                        <ShiftsMyShifts />
                        <ShiftsOpenShifts />
                        <ShiftsLeave />
                        <ShiftsMyAvailability />
                        <ShiftsMySwaps />
                    </div>
                ),
            },
        ]}
    />
)
