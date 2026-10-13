import { EmptyNotice, Skeleton, SurfaceCard } from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { AgentDashboardFrame } from "@/components/blocks/AgentDashboardFrame"
import { ShiftsAvailability } from "@/components/blocks/ShiftsAvailability"
import { ShiftsCoverage } from "@/components/blocks/ShiftsCoverage"
import { ShiftsDemand } from "@/components/blocks/ShiftsDemand"
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
import type { ShiftsBenchView, ShiftsMineView } from "@/modules/types"
import { PANEL_CLASS_NAME } from "./classNames"

/** One tab of the workbench: its id and its label. */
interface ShiftsTabView {
    readonly id: string
    readonly label: string
}

/** What the connected block settled: the frame state, the ribbon, the tab labels and the reads when they arrived. */
export interface ShiftsWorkbenchBaseProps {
    readonly props: {
        readonly installationId: string | null
        readonly initialTab: string | null
        /** The workbench is not read yet. */
        readonly isLoading: boolean
        /** The workbench could not be read. */
        readonly isFailed: boolean
        /** The signed-in person is staff: only their own schedule is shown, without the frame. */
        readonly isStaff: boolean
        readonly figures: ReadonlyArray<DescriptionListStatItem>
        readonly figuresFailed: boolean
        readonly tabs: ReadonlyArray<ShiftsTabView>
        /** The workbench of the week of today: setup, requests and the ribbon read from it. */
        readonly bench: ShiftsBenchView | undefined
        /** The workbench of the week on screen. */
        readonly week: ShiftsBenchView | undefined
        readonly mine: ShiftsMineView | undefined
        readonly noScheduleTitle: string
        readonly noScheduleBody: string
        readonly noProfileTitle: string
        readonly noProfileBody: string
    }
    readonly on: {
        readonly week: (monday: string) => void
    }
}

/** The blocks of the signed-in person's own schedule. */
const mineContent = (mine: ShiftsMineView, bench: ShiftsBenchView, noProfileTitle: string, noProfileBody: string) =>
    mine.profileId === null ? (
        <SurfaceCard ariaLabel={noProfileTitle}>
            <EmptyNotice message={noProfileTitle} description={noProfileBody} />
        </SurfaceCard>
    ) : (
        <div className={PANEL_CLASS_NAME}>
            <ShiftsMyShifts mine={mine} positions={bench.setup.positions} />
            <ShiftsOpenShifts mine={mine} positions={bench.setup.positions} />
            <ShiftsLeave mine={mine} />
            <ShiftsMyAvailability mine={mine} />
            <ShiftsMySwaps mine={mine} />
        </div>
    )

const setupContent = (bench: ShiftsBenchView) => (
    <div className={PANEL_CLASS_NAME}>
        <ShiftsPositions setup={bench.setup} />
        <ShiftsStaff bench={bench} />
        <ShiftsDemand setup={bench.setup} />
        <ShiftsAvailability bench={bench} />
        <ShiftsRules bench={bench} />
    </div>
)

/** Draws the Shifts workbench: the agent dashboard frame around the week, requests, setup, quick import and my-schedule areas; staff get their own schedule alone. */
export const ShiftsWorkbenchBase = (props: ShiftsWorkbenchBaseProps) => {
    const p = props.props
    const { bench, mine, week } = p
    if (bench !== undefined && mine !== undefined && p.isStaff) {
        return mineContent(mine, bench, p.noProfileTitle, p.noProfileBody)
    }
    const contentOf = (id: string) => {
        if (bench === undefined || mine === undefined) return undefined
        if (id === "requests") return <ShiftsRequests bench={bench} />
        if (id === "setup") return setupContent(bench)
        if (id === "quick") return <ShiftsQuickImport />
        if (id === "mine") return mineContent(mine, bench, p.noProfileTitle, p.noProfileBody)
        if (week === undefined) return <Skeleton shape="text" lines={4} />
        return (
            <div className={PANEL_CLASS_NAME}>
                <ShiftsWeekBar bench={week} onWeek={props.on.week} />
                {week.week.current === null ? (
                    <EmptyNotice message={p.noScheduleTitle} description={p.noScheduleBody} />
                ) : (
                    <>
                        <ShiftsWeekStats bench={week} />
                        {week.setup.blocks.length > 0 ? <ShiftsCoverage bench={week} /> : null}
                        <ShiftsGrid bench={week} />
                    </>
                )}
            </div>
        )
    }
    return (
        <AgentDashboardFrame
            module="shifts"
            installationId={p.installationId}
            isLoading={p.isLoading}
            figures={p.figures}
            figuresFailed={p.figuresFailed || p.isFailed}
            initialTab={p.initialTab}
            tabs={p.tabs.map((tab) => ({ id: tab.id, label: tab.label, content: contentOf(tab.id) }))}
        />
    )
}
