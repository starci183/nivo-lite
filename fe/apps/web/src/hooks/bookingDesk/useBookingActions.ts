import { useState, useTransition } from "react"
import type { BookingAction } from "@/modules/types"
import { NOTICE_OF_ACTION } from "./bookingDesk.shared"
import type { DeskNotice } from "./bookingDesk.shared"

/** The call the desk makes; the connected block owns the server action and hands it in. */
export interface BookingDeskActions {
    readonly act: (
        workspaceId: string,
        id: string,
        action: BookingAction,
    ) => Promise<{ readonly kind: "ok" } | { readonly kind: string; readonly code: string }>
}

/** The owner's commands on bookings; every answer becomes a notice and a refresh of the board. */
export const useBookingActions = (workspaceId: string, actions: BookingDeskActions, onChanged: () => void) => {
    const [notice, setNotice] = useState<DeskNotice | null>(null)
    const [isBusy, startTransition] = useTransition()

    return {
        notice,
        isBusy,
        dismiss: () => setNotice(null),
        act: (id: string, action: BookingAction, done: () => void) =>
            startTransition(async () => {
                const answer = await actions.act(workspaceId, id, action)
                if (answer.kind !== "ok") return setNotice({ tone: "negative", code: "failed" })
                setNotice({ tone: "affirmative", code: NOTICE_OF_ACTION[action] })
                done()
                onChanged()
            }),
    }
}
