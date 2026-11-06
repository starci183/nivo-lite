import { valueAt } from "../../spec/spec-value"
import type { SpecActionBinding, SpecViewCount, StoredSpec } from "../../spec/spec.types"
import type { HostRead } from "../../host/host.types"

/** The count chip of a tab. */
export interface CountChip {
    /** The number on the chip; absent while it is unknown (loading, failed, forbidden or not a number). */
    readonly count?: number
    /** Whether the chip reads in the attention tone: the view declares it and something waits. */
    readonly isAttention: boolean
}

/** What a view adds to the page frame beyond its block tree. */
export interface ViewChrome {
    /** The id of the view. */
    readonly id: string
    /** The count of its tab, when it declares one. */
    readonly count: SpecViewCount | undefined
    /** Its primary command, when it declares one. */
    readonly command: SpecActionBinding | undefined
}

/** The chrome of each view of a spec, in order. */
export const chromeOf = (spec: StoredSpec): ReadonlyArray<ViewChrome> =>
    spec.views.map((view) => ({ id: view.id, count: view.count, command: view.command }))

/** The chip of a count read: a number at the bound path of a ready read, in the attention tone only above zero. */
export const countChipOf = (read: Pick<HostRead, "status" | "data">, binding: SpecViewCount): CountChip => {
    const value = read.status === "ready" ? valueAt(read.data, binding.path) : undefined
    if (typeof value !== "number" || !Number.isFinite(value)) return { isAttention: false }
    return { count: value, isAttention: binding.isAttention === true && value > 0 }
}

/** The panes of a master-detail view on a phone, which shows one at a time. */
export type Pane = "list" | "detail"

/** The pane a `pane` param value names; anything else is the list. */
export const paneOf = (value: string | null): Pane => (value === "detail" ? "detail" : "list")
