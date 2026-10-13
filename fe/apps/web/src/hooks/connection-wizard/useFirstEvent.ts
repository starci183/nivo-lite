import { useEffect, useRef, useState, useTransition } from "react"
import type { DbOutcome } from "@/modules/db"
import type { FirstEvent, FirstEventState } from "@/modules/types"
import { POLL_MS } from "./connection-wizard.shared"

/** What waiting for the first event needs. */
interface FirstEventWatch {
    /** The connection to watch; the wait runs only while there is one. */
    readonly connectionId: string | null
    /** False outside the step that waits. */
    readonly isActive: boolean
    /** Asks the api whether the connection received its first event (handed in by the connected entry). */
    readonly check: (connectionId: string) => Promise<DbOutcome<FirstEventState>>
}

/**
 * Waits for the first event of a connection: asks the api every few seconds until an event arrives, then stops. A failed check is
 * shown softly and tried again on the next tick.
 */
export const useFirstEvent = (watch: FirstEventWatch) => {
    const [event, setEvent] = useState<FirstEvent | null>(null)
    const [failed, setFailed] = useState(false)
    const [tick, setTick] = useState(0)
    const [, startTransition] = useTransition()
    const latest = useRef(watch.check)
    const listening = watch.isActive && watch.connectionId !== null && event === null

    useEffect(() => {
        latest.current = watch.check
    })

    useEffect(() => {
        if (!listening) return undefined
        const timer = setInterval(() => setTick((count) => count + 1), POLL_MS)
        return () => clearInterval(timer)
    }, [listening])

    useEffect(() => {
        if (!listening || watch.connectionId === null) return undefined
        const connectionId = watch.connectionId
        let live = true
        startTransition(async () => {
            const outcome = await latest.current(connectionId)
            if (!live) return
            if (outcome.kind === "ok" && outcome.value.firstEvent !== null) setEvent(outcome.value.firstEvent)
            else setFailed(outcome.kind !== "ok")
        })
        return () => {
            live = false
        }
    }, [listening, tick, watch.connectionId])

    return { event, failed: failed && event === null }
}
