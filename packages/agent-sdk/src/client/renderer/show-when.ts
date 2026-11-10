import type { PlanNode } from "../../spec/render-plan"
import type { SpecShowWhen } from "../../spec/spec.types"

/** The value of `is` that stands for any value the param holds: the node shows while the param is set, whatever it holds. */
export const ANY_VALUE = "*"

/** Whether a node that shows for these param values is shown while the param holds `value` (null: not set). */
export const isShownFor = (showWhen: SpecShowWhen, value: string | null): boolean =>
    showWhen.is.includes(value ?? "") || (value !== null && value !== "" && showWhen.is.includes(ANY_VALUE))

/** Whether a node shows for any value of its param (the aside content that opens when a record is chosen). */
const isOpenedByAny = (showWhen: SpecShowWhen | null): boolean => showWhen?.is.includes(ANY_VALUE) === true

/**
 * Whether a region holds a node that is shown only while a param is set (the detail of a chosen record), and that param is set now:
 * a region with such a node is open whatever its summary counts, so a chosen record never lands in a collapsed aside.
 */
export const isOpenedBySelection = (node: PlanNode, valueOf: (param: string) => string | null): boolean => {
    const showWhen = node.showWhen
    if (isOpenedByAny(showWhen) && showWhen !== null && isShownFor(showWhen, valueOf(showWhen.param))) return true
    return node.children.some((child) => isOpenedBySelection(child, valueOf))
}
