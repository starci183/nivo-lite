import type { ShiftsWorkbenchOn } from "@/modules/types"
import { toast } from "@/modules/toast"
import {
    projectShiftsWorkbench,
    SHIFTS_TABS,
    type ShiftsPanelInput,
    type ShiftsProjectionInput,
} from "./shiftsWorkbench.shared"
import { useAgentDashboardFrame, useAgentWorkbenchTabs } from "@/hooks/agentDashboard"
import { useShiftsBenchData, useShiftsMineData } from "@/hooks/shifts"
import { useSlotLabels } from "@/hooks/slot"
import { useShiftsWeekStore } from "@/hooks/zustand/shiftsWeek"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useShiftsFiguresView } from "./useShiftsFiguresView"
import { useShiftsWeekBarView } from "./useShiftsWeekBarView"
import { useShiftsWeekStatsView } from "./useShiftsWeekStatsView"
import { useShiftsCoverageView } from "./useShiftsCoverageView"
import { useShiftsGridView } from "./useShiftsGridView"
import { useShiftsPositionsView } from "./useShiftsPositionsView"
import { useShiftsStaffView } from "./useShiftsStaffView"
import { useShiftsDemandView } from "./useShiftsDemandView"
import { useShiftsAvailabilityView } from "./useShiftsAvailabilityView"
import { useShiftsRulesView } from "./useShiftsRulesView"
import { useShiftsQuickImportView } from "./useShiftsQuickImportView"
import { useShiftsRequestsView } from "./useShiftsRequestsView"
import { useShiftsMyShiftsView } from "./useShiftsMyShiftsView"
import { useShiftsOpenShiftsView } from "./useShiftsOpenShiftsView"
import { useShiftsLeaveView } from "./useShiftsLeaveView"
import { useShiftsMyAvailabilityView } from "./useShiftsMyAvailabilityView"
import { useShiftsMySwapsView } from "./useShiftsMySwapsView"
interface ShiftsWorkbenchInput {
    readonly installationId: string | null
    readonly initialTab: string | null
    readonly tabs: Readonly<Record<(typeof SHIFTS_TABS)[number], string>>
}
/** Owns the actual dashboard and three independent transport scopes, without replacing the persistent week selection. */
export const useShiftsWorkbenchView = (input: ShiftsWorkbenchInput) => {
    const { activeWorkspaceId } = useActiveWorkspace(),
        labels = useSlotLabels()
    const scope = JSON.stringify([activeWorkspaceId, input.installationId])
    const tabs = useAgentWorkbenchTabs({ ids: SHIFTS_TABS, initialTab: input.initialTab, scope })
    const dashboard = useAgentDashboardFrame({
        module: "shifts",
        installationId: input.installationId,
        hasOwnGaps: false,
    })
    const isNormal = dashboard.why.workItemId === null
    const monday = useShiftsWeekStore((state) => state.monday)
    const bench = useShiftsBenchData(null, isNormal),
        week = useShiftsBenchData(monday, isNormal && tabs.selected === "week"),
        mine = useShiftsMineData(isNormal && tabs.selected === "mine")
    const panel = (id: (typeof SHIFTS_TABS)[number]): ShiftsPanelInput => ({
        bench: id === "week" ? week : bench,
        mine,
        scope,
        isActive: isNormal && tabs.selected === id,
    })
    const figures = useShiftsFiguresView({ ...panel("week"), bench, isActive: isNormal })
    const weekBar = useShiftsWeekBarView(panel("week"))
    const weekStats = useShiftsWeekStatsView(panel("week"))
    const coverage = useShiftsCoverageView(panel("week"))
    const grid = useShiftsGridView(panel("week"))
    const positions = useShiftsPositionsView(panel("setup"))
    const staff = useShiftsStaffView(panel("setup"))
    const demand = useShiftsDemandView(panel("setup"))
    const availability = useShiftsAvailabilityView(panel("setup"))
    const rules = useShiftsRulesView(panel("setup"))
    const quickImport = useShiftsQuickImportView(panel("quick"))
    const requests = useShiftsRequestsView(panel("requests"))
    const myShifts = useShiftsMyShiftsView(panel("mine"))
    const openShifts = useShiftsOpenShiftsView(panel("mine"))
    const leave = useShiftsLeaveView(panel("mine"))
    const myAvailability = useShiftsMyAvailabilityView(panel("mine"))
    const mySwaps = useShiftsMySwapsView(panel("mine"))

    const context = {
        dashboard,
        tabs,
        input,
        labels,
        bench,
        week,
        mine,
        figures,
        weekBar,
        weekStats,
        coverage,
        grid,
        positions,
        staff,
        demand,
        availability,
        rules,
        quickImport,
        requests,
        myShifts,
        openShifts,
        leave,
        myAvailability,
        mySwaps,
    }
    const props = projectShiftsWorkbench(context)
    const on = projectShiftsActions(context)
    const shape: (typeof SHIFTS_TABS)[number] | "explanation" = isNormal ? tabs.selected : "explanation"
    return { shape, props, on }
}

const projectShiftsActions = (context: ShiftsProjectionInput): ShiftsWorkbenchOn => {
    const {
        tabs,
        dashboard,
        labels,
        bench,
        week,
        mine,
        weekBar,
        grid,
        positions,
        staff,
        demand,
        availability,
        rules,
        quickImport,
        requests,
        myShifts,
        openShifts,
        leave,
        myAvailability,
    } = context
    const retry = (reads: ReadonlyArray<() => Promise<unknown>>) => () => {
        Promise.all(reads.map((read) => read())).catch(() => toast.danger(labels("").error))
    }
    return {
        selectTab: tabs.select,
        closeWhy: dashboard.closeWhy,
        retryDashboard: dashboard.reload,
        retryRibbon: retry([bench.mutate]),
        retryBench: retry([bench.mutate]),
        retryWeek: retry([week.mutate]),
        retryMine: retry([mine.mutate]),
        retryRoster: retry([mine.mutate, bench.mutate]),
        weekBar: weekBar.on,
        grid: grid.on,
        positions: positions.on,
        staff: staff.on,
        demand: demand.on,
        availability: availability.on,
        rules: rules.on,
        quickImport: quickImport.on,
        requests: requests.on,
        myShifts: myShifts.on,
        openShifts: openShifts.on,
        leave: leave.on,
        myAvailability: myAvailability.on,
    }
}
