import { isRecord } from "@modules/platform/primitives"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { workflowRefused } from "./workflow-view.policy"

/** The name the layout is kept under in the settings of the installation. */
export const GRAPH_LAYOUT_SETTING = "graphLayout"

/** How many workflows a saved layout may place. */
export const GRAPH_LAYOUT_KEY_LIMIT = 200

/** How far from the origin a position may be, on each axis. */
export const GRAPH_LAYOUT_COORDINATE_LIMIT = 100000

/** Where the Graph page draws one workflow. */
export interface GraphLayoutPosition {
    /** The key of the workflow. */
    readonly workflowKey: string
    /** The horizontal position. */
    readonly x: number
    /** The vertical position. */
    readonly y: number
}

const inBounds = (value: number): boolean =>
    Number.isFinite(value) && Math.abs(value) <= GRAPH_LAYOUT_COORDINATE_LIMIT

const isPosition = (value: unknown): value is GraphLayoutPosition =>
    isRecord(value) &&
    typeof value.workflowKey === "string" &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    inBounds(value.x) &&
    inBounds(value.y)

/** The last position given for each workflow, in the order the keys first appear. */
const lastPerKey = (positions: ReadonlyArray<GraphLayoutPosition>): ReadonlyArray<GraphLayoutPosition> => {
    const byKey = new Map<string, GraphLayoutPosition>()
    for (const position of positions) byKey.set(position.workflowKey, position)
    return [...byKey.values()]
}

/** The positions a caller sent, kept to the workflows the agent has; too many, or one that is not a finite number within bounds, is refused. */
export const checkedLayout = (
    positions: ReadonlyArray<GraphLayoutPosition>,
    workflowKeys: ReadonlySet<string>,
): ReadonlyArray<GraphLayoutPosition> => {
    if (positions.length > GRAPH_LAYOUT_KEY_LIMIT) throw workflowRefused("layout-size")
    if (!positions.every(isPosition)) throw workflowRefused("layout-position")
    return lastPerKey(positions).filter((position) => workflowKeys.has(position.workflowKey))
}

/** The layout saved in the settings, without the workflows the agent no longer has; anything unreadable is dropped. */
export const layoutOfSettings = (
    settings: InstallationRecord["settings"],
    workflowKeys: ReadonlySet<string>,
): ReadonlyArray<GraphLayoutPosition> => {
    const saved = settings[GRAPH_LAYOUT_SETTING]
    if (!Array.isArray(saved)) return []
    return lastPerKey(saved.filter(isPosition))
        .filter((position) => workflowKeys.has(position.workflowKey))
        .slice(0, GRAPH_LAYOUT_KEY_LIMIT)
        .map(({ workflowKey, x, y }) => ({ workflowKey, x, y }))
}

/** The settings with the layout replaced whole. */
export const settingsWithLayout = (
    settings: InstallationRecord["settings"],
    positions: ReadonlyArray<GraphLayoutPosition>,
): InstallationRecord["settings"] => ({ ...settings, [GRAPH_LAYOUT_SETTING]: [...positions] })
