import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { MessageRow, PendingAction, PendingSend } from "./conversation.types"

/** The pending messages with the state of the one a key names changed; the others stay as they are. */
const withState = (
    pending: ReadonlyArray<PendingSend>,
    key: string,
    state: PendingSend["state"],
): ReadonlyArray<PendingSend> => pending.map((entry) => (entry.key === key ? { ...entry, state } : entry))

/** What becomes of the pending messages when something happens to one of them. */
export const pendingReducer = (
    pending: ReadonlyArray<PendingSend>,
    action: PendingAction,
): ReadonlyArray<PendingSend> => {
    switch (action.type) {
        case "queue":
            return [...pending, { key: action.key, text: action.text, afterId: action.afterId, state: "sending" }]
        case "retry":
            return withState(pending, action.key, "sending")
        case "fail":
            return withState(pending, action.key, "failed")
        case "done":
            return withState(pending, action.key, "sent")
        case "discard":
            return pending.filter((entry) => entry.key !== action.key)
        case "settle": {
            const kept = pending.filter((entry) => entry.state !== "sent" || entry.afterId === action.lastId)
            return kept.length === pending.length ? pending : kept
        }
    }
}

/** The delivery mark a pending message shows while it travels. */
const DELIVERY_OF_STATE: Readonly<Record<PendingSend["state"], "queued" | "failed" | "sent">> = {
    sending: "queued",
    failed: "failed",
    sent: "sent",
}

/** A pending message as the thread draws it: the viewer's own message, without author or time. */
export const pendingRowOf = (entry: PendingSend): MessageRow => ({
    id: entry.key,
    author: "",
    text: entry.text,
    side: "outgoing",
    atMs: null,
    mark: "",
    delivery: DELIVERY_OF_STATE[entry.state],
})

/** The thread with the pending messages after the ones the server holds; a thread that holds none yet shows them alone. */
export const slotWithPending = (
    slot: DataSlot<ReadonlyArray<MessageRow>>,
    pending: ReadonlyArray<PendingSend>,
): DataSlot<ReadonlyArray<MessageRow>> => {
    if (pending.length === 0) return slot
    const rows = pending.map(pendingRowOf)
    if ("items" in slot) return { ...slot, items: [...slot.items, ...rows] }
    return "isEmpty" in slot ? { items: rows } : slot
}
