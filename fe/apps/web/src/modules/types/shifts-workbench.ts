import type { DataSlot, SlotLabels } from "./slot"
import type { WorkbenchDashboardRegions, WorkbenchExplanationView } from "./workbench-dashboard"
import type { ShiftsWeekViews, ShiftsWeekActions } from "./shifts-workbench-week"
import type { ShiftsSetupViews, ShiftsSetupActions } from "./shifts-workbench-setup"
import type { ShiftsRequestViews, ShiftsRequestActions } from "./shifts-workbench-requests"
import type { ShiftsPersonalViews, ShiftsPersonalActions } from "./shifts-workbench-mine"
/** Read payloads keep every drawn query fact, while copy and local control state stay outside their slots. */
export interface ShiftsWorkbenchData {
    readonly why: WorkbenchExplanationView
    readonly regions: WorkbenchDashboardRegions
    readonly tabsLabel: string
    readonly selectedTab: string
    readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly ribbon: {
        readonly slot: DataSlot<ShiftsWeekViews["figuresData"]>
        readonly copy: ShiftsWeekViews["figuresCopy"]
        readonly labels: SlotLabels
    }
    readonly week: {
        readonly slot: DataSlot<ShiftsWeekViews["weekReady"]>
        readonly copy: ShiftsWeekViews["weekCopy"]
        readonly labels: SlotLabels
    }
    readonly requests: {
        readonly slot: DataSlot<ShiftsRequestViews["requestsReady"]>
        readonly copy: ShiftsRequestViews["requestsCopy"]
        readonly labels: SlotLabels
    }
    readonly setup: {
        readonly slot: DataSlot<ShiftsSetupViews["setupReady"]>
        readonly copy: ShiftsSetupViews["setupCopy"]
        readonly labels: SlotLabels
    }
    readonly quick: {
        readonly slot: DataSlot<ShiftsSetupViews["quickReady"]>
        readonly copy: ShiftsSetupViews["quickCopy"]
        readonly labels: SlotLabels
    }
    readonly roster: {
        readonly slot: DataSlot<ShiftsPersonalViews["rosterReady"]>
        readonly copy: ShiftsPersonalViews["rosterCopy"]
        readonly labels: SlotLabels
    }
    readonly personal: {
        readonly slot: DataSlot<ShiftsPersonalViews["personalReady"]>
        readonly copy: ShiftsPersonalViews["personalCopy"]
        readonly labels: SlotLabels
    }
}
/** Events are independent of every read payload and retain each initiating card's command owner. */
export interface ShiftsWorkbenchOn {
    readonly selectTab: (id: string) => void
    readonly closeWhy: () => void
    readonly retryDashboard: () => void
    readonly retryRibbon: () => void
    readonly retryWeek: () => void
    readonly retryBench: () => void
    readonly retryMine: () => void
    readonly retryRoster: () => void
    readonly weekBar: ShiftsWeekActions["weekBar"] | undefined
    readonly grid: ShiftsWeekActions["grid"] | undefined
    readonly positions: ShiftsSetupActions["positions"] | undefined
    readonly staff: ShiftsSetupActions["staff"] | undefined
    readonly demand: ShiftsSetupActions["demand"] | undefined
    readonly availability: ShiftsSetupActions["availability"] | undefined
    readonly rules: ShiftsSetupActions["rules"] | undefined
    readonly quickImport: ShiftsSetupActions["quickImport"] | undefined
    readonly requests: ShiftsRequestActions["requests"] | undefined
    readonly myShifts: ShiftsPersonalActions["myShifts"] | undefined
    readonly openShifts: ShiftsPersonalActions["openShifts"] | undefined
    readonly leave: ShiftsPersonalActions["leave"] | undefined
    readonly myAvailability: ShiftsPersonalActions["myAvailability"] | undefined
}
