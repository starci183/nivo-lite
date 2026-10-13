import { useState } from "react"
import { POLL_MS } from "@/hooks/connection-wizard"
import { useQueryConnectionFirstEventSwr } from "@/hooks/swr"
import type { FirstEvent } from "@/modules/types"
import { firstEventStateOf } from "@/hooks/connection-wire"

/** What waiting for the first event needs. */
interface FirstEventWatch {
    /** The connection to watch; the wait runs only while there is one. */
    readonly connectionId: string | null
    /** False outside the step that waits. */
    readonly isActive: boolean
}

/**
 * Waits for the first event of a connection: the status query is asked every few seconds (SWR refresh interval) until an event
 * arrives, then it stops. A failed check is shown softly and tried again on the next tick.
 */
export const useFirstEvent = (watch: FirstEventWatch) => {
    const [event, setEvent] = useState<FirstEvent | null>(null)
    const listening = watch.isActive && watch.connectionId !== null && event === null
    const { error } = useQueryConnectionFirstEventSwr(listening ? (watch.connectionId ?? undefined) : undefined, {
        refreshInterval: POLL_MS,
        onSuccess: (data) => {
            const arrived = firstEventStateOf(data).firstEvent
            if (arrived !== null) setEvent(arrived)
        },
    })
    return { event, failed: error !== undefined && event === null }
}
