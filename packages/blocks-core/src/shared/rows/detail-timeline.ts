import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import { textOf, valueAt } from "../slots/paths"
import { formatValue, type CellContext } from "./cell-format"

/** What the detail's timeline reads from a record: the list of steps and where each step's words and time stand. */
export interface DetailTimelineSpec {
    /** The words of the heading of the timeline. */
    readonly title: SpecText
    /** The path of the list of steps in the record. */
    readonly listPath: string
    /** The path of the words of a step. */
    readonly textPath: string
    /** The path of the line under the words, such as who did it; absent draws none. */
    readonly notePath?: string | undefined
    /** The path of the time of a step; absent draws none. */
    readonly atPath?: string | undefined
}

/** One step of the timeline as it is drawn. */
export interface DetailTimelineStep {
    /** The key the step is drawn under. */
    readonly id: string
    /** The words of the step. */
    readonly text: string
    /** The line under the words; empty draws none. */
    readonly note: string
    /** The time of the step as the viewer reads it; empty draws none. */
    readonly at: string
}

/** The steps of a record in the order the record lists them; a step without words is left out. */
export const detailTimelineOf = (
    record: unknown,
    spec: DetailTimelineSpec,
    context: CellContext,
): ReadonlyArray<DetailTimelineStep> => {
    const list = valueAt(record, spec.listPath)
    if (!Array.isArray(list)) return []
    return list.flatMap((entry: unknown, index): ReadonlyArray<DetailTimelineStep> => {
        const text = textOf(valueAt(entry, spec.textPath))
        if (text === "") return []
        const at = spec.atPath === undefined ? "" : formatValue(valueAt(entry, spec.atPath), "dateTime", context)
        return [{ id: `${index}`, text, note: textOf(valueAt(entry, spec.notePath)), at }]
    })
}
