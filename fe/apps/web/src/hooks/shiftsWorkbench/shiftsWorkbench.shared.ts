import { slotOfReads } from "@/hooks/slot"
import type { useSlotLabels } from "@/hooks/slot"
import type { useAgentDashboardFrame, useAgentWorkbenchTabs } from "@/hooks/agentDashboard"
import type { ShiftsWorkbenchData } from "@/modules/types"
import type { useShiftsFiguresView } from "./useShiftsFiguresView"
import type { useShiftsWeekBarView } from "./useShiftsWeekBarView"
import type { useShiftsWeekStatsView } from "./useShiftsWeekStatsView"
import type { useShiftsCoverageView } from "./useShiftsCoverageView"
import type { useShiftsGridView } from "./useShiftsGridView"
import type { useShiftsPositionsView } from "./useShiftsPositionsView"
import type { useShiftsStaffView } from "./useShiftsStaffView"
import type { useShiftsDemandView } from "./useShiftsDemandView"
import type { useShiftsAvailabilityView } from "./useShiftsAvailabilityView"
import type { useShiftsRulesView } from "./useShiftsRulesView"
import type { useShiftsQuickImportView } from "./useShiftsQuickImportView"
import type { useShiftsRequestsView } from "./useShiftsRequestsView"
import type { useShiftsMyShiftsView } from "./useShiftsMyShiftsView"
import type { useShiftsOpenShiftsView } from "./useShiftsOpenShiftsView"
import type { useShiftsLeaveView } from "./useShiftsLeaveView"
import type { useShiftsMyAvailabilityView } from "./useShiftsMyAvailabilityView"
import type { useShiftsMySwapsView } from "./useShiftsMySwapsView"
import type { useShiftsBenchData, useShiftsMineData } from "@/hooks/shifts"
/** One real mounted tab session; Monday remains the persistent store's separate authority. */
export interface ShiftsPanelInput {
    readonly bench: ReturnType<typeof useShiftsBenchData>
    readonly mine: ReturnType<typeof useShiftsMineData>
    readonly scope: string
    readonly isActive: boolean
}
/** The five recorded URL panels, in their original order. */
export const SHIFTS_TABS = ["week", "requests", "setup", "quick", "mine"] as const

/** Actual private domain projections consumed by the workbench orchestrator. */
export interface ShiftsProjectionInput {
    readonly dashboard: ReturnType<typeof useAgentDashboardFrame>
    readonly tabs: ReturnType<typeof useAgentWorkbenchTabs>
    readonly input: { readonly tabs: Readonly<Record<(typeof SHIFTS_TABS)[number], string>> }
    readonly labels: ReturnType<typeof useSlotLabels>
    readonly bench: ReturnType<typeof useShiftsBenchData>
    readonly week: ReturnType<typeof useShiftsBenchData>
    readonly mine: ReturnType<typeof useShiftsMineData>
    readonly figures: ReturnType<typeof useShiftsFiguresView>
    readonly weekBar: ReturnType<typeof useShiftsWeekBarView>
    readonly weekStats: ReturnType<typeof useShiftsWeekStatsView>
    readonly coverage: ReturnType<typeof useShiftsCoverageView>
    readonly grid: ReturnType<typeof useShiftsGridView>
    readonly positions: ReturnType<typeof useShiftsPositionsView>
    readonly staff: ReturnType<typeof useShiftsStaffView>
    readonly demand: ReturnType<typeof useShiftsDemandView>
    readonly availability: ReturnType<typeof useShiftsAvailabilityView>
    readonly rules: ReturnType<typeof useShiftsRulesView>
    readonly quickImport: ReturnType<typeof useShiftsQuickImportView>
    readonly requests: ReturnType<typeof useShiftsRequestsView>
    readonly myShifts: ReturnType<typeof useShiftsMyShiftsView>
    readonly openShifts: ReturnType<typeof useShiftsOpenShiftsView>
    readonly leave: ReturnType<typeof useShiftsLeaveView>
    readonly myAvailability: ReturnType<typeof useShiftsMyAvailabilityView>
    readonly mySwaps: ReturnType<typeof useShiftsMySwapsView>
}
/** Folds each genuine transport group into the compact read payload drawn by that region. */
export const projectShiftsWorkbench = (context: ShiftsProjectionInput): ShiftsWorkbenchData => {
    const { dashboard, tabs, input, labels, bench, figures } = context
    return {
        why: dashboard.why,
        regions: dashboard.regions,
        tabsLabel: dashboard.tabsLabel,
        selectedTab: tabs.selected,
        tabs: SHIFTS_TABS.map((id) => ({ id, label: input.tabs[id] })),
        ribbon: { slot: slotOfReads([bench], () => figures.data), copy: figures.copy, labels: labels("") },
        ...projectModuleRegions(context),
    }
}

const projectModuleRegions = (context: ShiftsProjectionInput) => {
    const {
        bench,
        week,
        labels,
        weekBar,
        weekStats,
        coverage,
        grid,
        positions,
        staff,
        demand,
        availability,
        rules,
        requests,
        quickImport,
    } = context
    return {
        week: {
            slot: slotOfReads([week], () => ({
                isVisible: week.data?.role !== "staff",
                weekBar: weekBar.data,
                weekStats: weekStats.data,
                coverage: coverage.data,
                grid: grid.data,
            })),
            copy: { weekBar: weekBar.copy, weekStats: weekStats.copy, coverage: coverage.copy, grid: grid.copy },
            labels: labels(""),
        },
        requests: {
            slot: slotOfReads([bench], () => ({ isVisible: bench.data?.role !== "staff", requests: requests.data })),
            copy: { requests: requests.copy },
            labels: labels(""),
        },
        setup: {
            slot: slotOfReads([bench], () => ({
                isVisible: bench.data?.role !== "staff",
                positions: positions.data,
                staff: staff.data,
                demand: demand.data,
                availability: availability.data,
                rules: rules.data,
            })),
            copy: {
                positions: positions.copy,
                staff: staff.copy,
                demand: demand.copy,
                availability: availability.copy,
                rules: rules.copy,
            },
            labels: labels(""),
        },
        quick: {
            slot: slotOfReads([bench], () => ({
                isVisible: bench.data?.role !== "staff",
                quickImport: quickImport.data,
            })),
            copy: { quickImport: quickImport.copy },
            labels: labels(""),
        },
        ...projectMineRegions(context),
    }
}

const projectMineRegions = (context: ShiftsProjectionInput) => {
    const { bench, labels, mine, myShifts, openShifts, leave, myAvailability, mySwaps } = context
    return {
        roster: {
            slot: slotOfReads([mine, bench], () => ({
                isVisible: true,
                myShifts: myShifts.data,
                openShifts: openShifts.data,
            })),
            copy: { myShifts: myShifts.copy, openShifts: openShifts.copy },
            labels: labels(""),
        },
        personal: {
            slot: slotOfReads([mine], () => ({
                isVisible: mine.data?.profileId !== null && mine.data?.profileId !== undefined,
                leave: leave.data,
                myAvailability: myAvailability.data,
                mySwaps: mySwaps.data,
            })),
            copy: { leave: leave.copy, myAvailability: myAvailability.copy, mySwaps: mySwaps.copy },
            labels: labels(""),
        },
    }
}
