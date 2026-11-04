import type { ActionInput, ActionOutcome, BlockHost, ReadPage, ReadVariables } from "../block/block.types"
import type { SlotLabels } from "../slot/slot.types"

/** The state of one read as the host's transport reports it. */
export interface HostRead {
    /** Where the read stands: loading, ready, failed, or refused for lack of a permission. */
    readonly status: "loading" | "ready" | "error" | "forbidden"
    /** The read's answer; meaningful only when `status` is `ready`. */
    readonly data: unknown
    /** True while a ready read is being refreshed in the background. */
    readonly isValidating: boolean
    /** Reads this read again. */
    readonly reload: () => void
    /** Paging of the read, when it has any. */
    readonly page: ReadPage | null
}

/** One action of the host: run it, and whether one is running. */
export interface HostAction {
    /** Runs the action with the given input and settles to its outcome. */
    readonly run: (input: ActionInput) => Promise<ActionOutcome>
    /** True while a run of this action is in flight. */
    readonly isRunning: boolean
}

/**
 * The host the renderer draws against: the ports a block reaches (`block`) and the data ports only the renderer uses. The app
 * implements it over its transport, router and translations; `./testing` has a fake.
 */
export interface WorkbenchHost {
    /** The ports a block reaches: navigation, messages and the like. */
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
