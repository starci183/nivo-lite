import type { ActionInput, ActionOutcome, BlockHost, ReadPage, ReadVariables } from "../block/block.types"
import type { SlotLabels } from "../slot/slot.types"

/** The state of one read as the host's transport reports it. */
export interface HostRead {
    /** Where the read stands: running, settled, failed or refused for the viewer. */
    readonly status: "loading" | "ready" | "error" | "forbidden"
    /** What the read yielded; meaningful once the status is ready. */
    readonly data: unknown
    /** Whether the read runs again while its data shows. */
    readonly isValidating: boolean
    /** Reads this read again. */
    readonly reload: () => void
    /** Paging of the read, when it has any. */
    readonly page: ReadPage | null
}

/** One action of the host: run it, and whether one is running. */
export interface HostAction {
    /** Runs the action with the given input and says how it ended. */
    readonly run: (input: ActionInput) => Promise<ActionOutcome>
    /** Whether a run is in flight. */
    readonly isRunning: boolean
}

/**
 * The host the renderer draws against: the ports a block reaches (`block`) and the data ports only the renderer uses. The app
 * implements it over its transport, router and translations; `./testing` has a double.
 */
export interface WorkbenchHost {
    /** The ports a block reaches: words, navigation, toasts and defect reports. */
    readonly block: BlockHost
    /** A hook: one read by operation name; null variables do not fetch. */
    readonly useRead: (operation: string, variables: ReadVariables | null) => HostRead
    /** A hook: one action by operation name. */
    readonly useAction: (operation: string) => HostAction
    /** A hook: whether the viewer holds a permission; true for null. */
    readonly useCan: (permission: string | null) => boolean
    /** A hook: the words of the data-status recipe, with the empty sentence of one region. */
    readonly useSlotLabels: () => (empty: string) => SlotLabels
}
