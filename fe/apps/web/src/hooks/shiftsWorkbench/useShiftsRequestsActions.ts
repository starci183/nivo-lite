import { useShiftsRequestCommands } from "@/hooks/shiftsCommands"
import type { ShiftsRequestActions } from "@/modules/types"
import { useShiftsOperation } from "./useShiftsOperation"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"
/** Keeps the requests card's decision feedback and cache work in the initiating pending session. */
export const useShiftsRequestsActions = (input: ShiftsPanelInput) => {
    const commands = useShiftsRequestCommands(),
        operation = useShiftsOperation(input)
    const decide = (kind: "item" | "availability", targetId: string, approve: boolean) => {
        const status = approve ? "approved" : "rejected"
        operation.observe(
            operation.run("decide", () =>
                kind === "item"
                    ? commands.decideItem(targetId, status)
                    : commands.decideAvailability(targetId, approve),
            ),
        )
    }
    const on: ShiftsRequestActions["requests"] = {
        approve: (kind, targetId) => decide(kind, targetId, true),
        decline: (kind, targetId) => decide(kind, targetId, false),
    }
    return { isBusy: operation.tag !== null, on }
}
