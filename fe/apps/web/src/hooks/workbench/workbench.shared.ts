import { mapSlot } from "@/hooks/slot"
import type {
    DataSlot,
    PaneGridLayout,
    WorkbenchCommandData,
    WorkbenchCommandView,
    WorkbenchRowData,
    WorkbenchRowView,
} from "@/modules/types"

/** Carries command copy and capability facts across a pure boundary, without its world-owned operation. */
const commandDataOf = (command: WorkbenchCommandView): WorkbenchCommandData => ({
    id: command.id,
    label: command.label,
    ...(command.isPending === undefined ? {} : { isPending: command.isPending }),
    ...(command.isDisabled === undefined ? {} : { isDisabled: command.isDisabled }),
    ...(command.disabledReason === undefined ? {} : { disabledReason: command.disabledReason }),
})

/** A resolved waiting row has data alone; the connected owner retains all command bindings. */
export const workbenchRowDataOf = (row: WorkbenchRowView): WorkbenchRowData => ({
    id: row.id,
    title: row.title,
    description: row.description,
    badges: row.badges,
    reason: row.reason,
    amount: row.amount,
    proposal: row.proposal,
    trace: row.trace,
    expiry: row.expiry,
    primary: row.primary === null ? null : commandDataOf(row.primary),
    edit: row.edit === null ? null : commandDataOf(row.edit),
    menu: row.menu.map((command) => ({
        ...commandDataOf(command),
        ...(command.isDanger === undefined ? {} : { isDanger: command.isDanger }),
    })),
    waitingFor: row.waitingFor,
})

type WorkbenchWaitingDataOfResult = {
    slot: DataSlot<WorkbenchRowData[]>
    on: {
        command: (rowId: string, commandId: string) => void
    }
}

/** Separates a live owner's waiting read from its atomic row/command-id dispatcher. */
export const workbenchWaitingDataOf = (
    slot: DataSlot<ReadonlyArray<WorkbenchRowView>>,
): WorkbenchWaitingDataOfResult => ({
    slot: mapSlot(slot, (rows) => rows.map(workbenchRowDataOf)),
    on: {
        command: (rowId: string, commandId: string): void => {
            const row = "items" in slot ? slot.items.find((item) => item.id === rowId) : undefined
            if (row === undefined) return
            if (row.primary?.id === commandId) {
                row.primary.onPress()
                return
            }
            if (row.edit?.id === commandId) {
                row.edit.onPress()
                return
            }
            row.menu.find((command) => command.id === commandId)?.onPress()
        },
    },
})

/** Which of the workbench's two panes the owner chose: the default arrangement, the decisions as the one pane a phone shows, or the side pane closed. */
export type WorkbenchPane = "default" | "waiting" | "closed"

/** What decides the arrangement of a workbench's panes. */
interface WorkbenchGridInput {
    readonly pane: WorkbenchPane
    /** A decision is explained: the side pane holds the explanation, so it is shown. */
    readonly hasWhy: boolean
}

/**
 * The areas and tracks of every workbench: the tabs band over the work, and the side pane (its head over its body) beside
 * them from 70rem. A phone shows one pane: the work with its tabs, or the side pane when the owner opened it or an
 * explanation is open. The owner may close the side pane; an open explanation reopens it.
 */
export const workbenchGridOf = (input: WorkbenchGridInput): PaneGridLayout => {
    const isAsideShown = input.pane !== "closed" || input.hasWhy
    const isAsideAlone = input.pane === "waiting" || input.hasWhy
    const single = isAsideAlone ? ["asideHead", "aside"] : ["head", "main"]
    return {
        areas: {
            base: single,
            medium: single,
            wide: isAsideShown ? ["head asideHead", "main aside"] : ["head", "main"],
        },
        columns: {
            base: ["fill"],
            medium: ["fill"],
            wide: isAsideShown ? ["fill", "standard"] : ["fill"],
        },
        rows: { base: ["auto", "fill"], medium: ["auto", "fill"], wide: ["auto", "fill"] },
    }
}
