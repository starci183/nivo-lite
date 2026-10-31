import type { SWRResponse } from "swr"
import { slotOfSwr } from "@/hooks/slot"
import { isInvalidFailure, isNotFoundFailure } from "@/modules/failure"
import type { ConnectionNotice, DataSlot, SlotLabels } from "@/modules/types"

/** The refresh interval of a connection page: never while the connection is healthy, else every `pollMs`. */
export const pollUnlessHealthy =
    (pollMs: number) =>
    (page: { readonly healthy: boolean } | undefined): number =>
        page?.healthy === true ? 0 : pollMs

/** Whether a failed read of a connection page means no such connection exists (an id the back end does not know, or one that is no id). */
const isMissingPageRead = (error: unknown): boolean =>
    error !== undefined && (isNotFoundFailure(error) || isInvalidFailure(error))

/**
 * What a connection page makes of its read: the slot, `isMissing` once the back end says no such connection exists (the page then
 * answers `notFound()` once), and the two ways to ask again.
 */
export const connectionPageOf = <T>(read: SWRResponse<T, unknown>) => ({
    slot: slotOfSwr(read),
    isMissing: isMissingPageRead(read.error),
    reload: () => void read.mutate(),
    mutate: read.mutate,
})

/** The notice a provider page leads with when its connection could not be read (retry offered) or was refused (nothing to retry). */
export const readFailureNotice = (
    slot: DataSlot<unknown>,
    labels: SlotLabels,
    retry: () => void,
): ConnectionNotice | undefined => {
    if (slot.isForbidden === true) return { id: "failure", tone: "negative", title: labels.forbidden }
    if (slot.isError !== true) return undefined
    return { id: "failure", tone: "negative", title: labels.error, action: { label: labels.retry, run: retry } }
}
