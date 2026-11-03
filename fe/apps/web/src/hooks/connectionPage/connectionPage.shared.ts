import type { SWRResponse, KeyedMutator } from "swr"
import { slotOfSwr } from "@/hooks/slot"
import { isInvalidFailure, isNotFoundFailure } from "@/modules/failure"
import { CONSOLE_ROUTES } from "@/modules/routes"
import type {
    ConnectionHeadView,
    ConnectionNotice,
    ConnectionPageHeadView,
    DataSlot,
    SlotLabels,
} from "@/modules/types"

/** How many times slower a healthy connection page is asked again than one that needs attention. */
const HEALTHY_SLOWDOWN = 4

/**
 * The refresh interval of a connection page: every `pollMs` while the connection needs attention, and `HEALTHY_SLOWDOWN` times
 * slower while it is healthy. It is never 0: a read that stops at a healthy first answer is never asked again, so a token that
 * expires later would stay "healthy" on screen.
 */
export const pollConnectionPage =
    (pollMs: number) =>
    (page: { readonly healthy: boolean } | undefined): number =>
        page?.healthy === true ? pollMs * HEALTHY_SLOWDOWN : pollMs

/** Whether a failed read of a connection page means no such connection exists (an id the back end does not know, or one that is no id). */
const isMissingPageRead = (error: unknown): boolean =>
    error !== undefined && (isNotFoundFailure(error) || isInvalidFailure(error))

/**
 * What a connection page makes of its read: the slot, `isMissing` once the back end says no such connection exists (the page then
 * answers `notFound()` once), and the two ways to ask again.
 */
export const connectionPageOf = <T>(
    read: SWRResponse<T, unknown>,
): {
    read: SWRResponse<T, unknown>
    slot: DataSlot<T>
    isMissing: boolean
    reload: () => undefined
    mutate: KeyedMutator<T>
} => ({
    read,
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
    if ("isForbidden" in slot) return { id: "failure", tone: "negative", title: labels.forbidden }
    if (!("isError" in slot)) return undefined
    return { id: "failure", tone: "negative", title: labels.error, action: { label: labels.retry, run: retry } }
}

/** What the header of a provider page knows of its connection: the head once read, and whether it is still being read. */
export const connectionHeadStateOf = (
    head: DataSlot<ConnectionHeadView>,
): Pick<ConnectionPageHeadView, "head" | "isLoading"> => ({
    ...("items" in head ? { head: head.items } : {}),
    isLoading: "isLoading" in head,
})

/** The trail of a provider page: the list of connections, then the connection itself. */
export const connectionCrumbsOf = (
    connectionsLabel: string,
    current: ConnectionPageHeadView["crumbs"][number],
): ConnectionPageHeadView["crumbs"] => [
    { id: "connections", label: connectionsLabel, href: CONSOLE_ROUTES.connections },
    current,
]

/** One setup step as a reader sees it, with the id that picks it among the steps of a connection. */
interface SetupStepSource<Id extends string> {
    readonly id: Id
    readonly ordinal: number
    readonly title: string
    readonly summary: string
    readonly hint: string
    readonly isOpen: boolean
}

/** The step of the given id (the first when none matches), with every word empty while the steps are not read yet. */
export const setupStepViewOf = <Id extends string>(
    steps: ReadonlyArray<SetupStepSource<Id>>,
    id: Id,
): {
    ordinal: number
    title: string
    summary: string
    hint: string
    isOpen: boolean
} => {
    const step = steps.find((candidate) => candidate.id === id) ?? steps[0]
    return {
        ordinal: step?.ordinal ?? 1,
        title: step?.title ?? "",
        summary: step?.summary ?? "",
        hint: step?.hint ?? "",
        isOpen: step?.isOpen ?? false,
    }
}
