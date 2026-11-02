import { mapSlot } from "@/hooks/slot"
import type {
    DataSlot,
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

/** Separates a live owner's waiting read from its atomic row/command-id dispatcher. */
export const workbenchWaitingDataOf = (slot: DataSlot<ReadonlyArray<WorkbenchRowView>>) => ({
    slot: mapSlot(slot, (rows) => rows.map(workbenchRowDataOf)),
    on: {
        command: (rowId: string, commandId: string) => {
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
