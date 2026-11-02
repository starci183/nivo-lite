import type { ShiftsSetupViews } from "./shifts-workbench-setup"

/** The swap form of the one shift being swapped; `shiftId` is `null` when none is open. */
interface MyShiftsSwapForm {
    readonly shiftId: string | null
    readonly toStaffId: string
    readonly reason: string
}

/** One of my shifts. */
interface MyShiftsMyShiftView {
    readonly id: string
    readonly title: string
    readonly notes: ReadonlyArray<string>
    readonly isCheckedIn: boolean
    /** The shift is today, so checking in is offered. */
    readonly canCheckIn: boolean
    readonly isBusy: boolean
}

/** Actual resolved mine drawings, shared by the world controller and pure ready anatomy. */
export interface ShiftsPersonalViews {
    readonly rosterReady: {
        readonly isVisible: boolean
        readonly myShifts: ShiftsPersonalViews["myShiftsData"] | undefined
        readonly openShifts: ShiftsPersonalViews["openShiftsData"] | undefined
    }
    readonly rosterCopy: {
        readonly myShifts: ShiftsPersonalViews["myShiftsCopy"]
        readonly openShifts: ShiftsPersonalViews["openShiftsCopy"]
    }

    readonly personalReady: {
        readonly isVisible: boolean
        readonly leave: ShiftsPersonalViews["leaveData"] | undefined
        readonly myAvailability: ShiftsPersonalViews["myAvailabilityData"] | undefined
        readonly mySwaps: ShiftsPersonalViews["mySwapsData"] | undefined
    }
    readonly personalCopy: {
        readonly leave: ShiftsPersonalViews["leaveCopy"]
        readonly myAvailability: ShiftsPersonalViews["myAvailabilityCopy"]
        readonly mySwaps: ShiftsPersonalViews["mySwapsCopy"]
    }

    readonly myShiftsData: Pick<ShiftsPersonalViews["myShifts"], "notice" | "shifts" | "swapOptions">
    readonly myShiftsCopy: Omit<ShiftsPersonalViews["myShifts"], "notice" | "shifts" | "swapOptions">

    readonly openShiftsData: Pick<ShiftsPersonalViews["openShifts"], "shifts">
    readonly openShiftsCopy: Omit<ShiftsPersonalViews["openShifts"], "shifts">

    readonly leaveData: Pick<ShiftsPersonalViews["leave"], "fields" | "rows">
    readonly leaveCopy: Omit<ShiftsPersonalViews["leave"], "fields" | "rows">

    readonly myAvailabilityData: Pick<ShiftsPersonalViews["myAvailability"], "fields" | "rows">
    readonly myAvailabilityCopy: Omit<ShiftsPersonalViews["myAvailability"], "fields" | "rows">

    readonly mySwapsData: Pick<ShiftsPersonalViews["mySwaps"], "rows">
    readonly mySwapsCopy: Omit<ShiftsPersonalViews["mySwaps"], "rows">

    readonly myShifts: {
        /** The account is not on the schedule: this notice replaces the list. */
        readonly notice: { readonly title: string; readonly body: string } | null
        readonly title: string
        readonly hint: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly checkInLabel: string
        readonly checkedInLabel: string
        readonly askSwapLabel: string
        readonly swapWithLabel: string
        readonly pickPersonLabel: string
        readonly reasonLabel: string
        readonly sendLabel: string
        readonly shifts: ReadonlyArray<MyShiftsMyShiftView>
        readonly swap: MyShiftsSwapForm
        readonly swapOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    }
    readonly myShiftsSwapForm: MyShiftsSwapForm
    readonly myShiftsMyShiftView: MyShiftsMyShiftView
    readonly openShifts: {
        readonly title: string
        readonly hint: string
        readonly emptyLabel: string
        readonly claimLabel: string
        readonly shifts: ReadonlyArray<{
            readonly id: string
            readonly title: string
            readonly notes: ReadonlyArray<string>
            readonly isBusy: boolean
        }>
    }
    readonly leave: ShiftsSetupViews["formCard"]
    readonly myAvailability: ShiftsSetupViews["formCard"]
    readonly mySwaps: {
        readonly title: string
        readonly emptyLabel: string
        readonly rows: ReadonlyArray<{
            readonly id: string
            readonly text: string
            readonly tone: "success" | "neutral" | "warning"
            readonly badge: string
        }>
    }
}

/** Commands stay separate from the resolved mine data contract. */
export interface ShiftsPersonalActions {
    readonly myShifts: {
        readonly checkIn: (id: string) => void
        readonly toggleSwap: (id: string) => void
        readonly target: (id: string) => void
        readonly reason: (text: string) => void
        readonly send: (id: string) => void
    }
    readonly openShifts: {
        readonly claim: (id: string) => void
    }
    readonly leave: {
        readonly field: (id: string, value: string) => void
        readonly submit: () => void
    }
    readonly myAvailability: {
        readonly field: (id: string, value: string) => void
        readonly available: (value: boolean) => void
        readonly submit: () => void
    }
    readonly mySwaps: Record<string, never>
}
