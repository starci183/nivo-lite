import type { SavingLine } from "../workspace-dashboard.contracts"

/**
 * The definition of "hours saved", in the open. Every item an agent finished is worth the minutes a person would have spent doing the
 * same thing by hand (reading, deciding, typing, sending). The number is an estimate a small shop agrees with, not a measurement: it is
 * shown on hover beside the figure and is the one place to change it. No module's action has a figure of its own here.
 */
/** What one finished item is worth, minutes. */
export const DEFAULT_MINUTES = 2

/** The most lines of the definition the dashboard returns. */
const LINES_MAX = 8

/** One action and how many of it were finished. */
export interface FinishedAction {
    /** The action key. */
    readonly action: string
    /** How many were finished. */
    readonly count: number
}

/** The minutes saved by finishing these actions. */
export const minutesSavedBy = (finished: ReadonlyArray<FinishedAction>): number =>
    finished.reduce((sum, item) => sum + item.count * DEFAULT_MINUTES, 0)

/** The lines of the definition: each action once, its count summed, the one worth the most minutes first. */
export const savingLinesOf = (finished: ReadonlyArray<FinishedAction>): ReadonlyArray<SavingLine> => {
    const counts = new Map<string, number>()
    for (const item of finished) counts.set(item.action, (counts.get(item.action) ?? 0) + item.count)
    return [...counts]
        .filter(([, count]) => count > 0)
        .map(([action, count]) => ({ action, count, minutesEach: DEFAULT_MINUTES }))
        .sort(
            (left, right) =>
                right.count * right.minutesEach - left.count * left.minutesEach ||
                left.action.localeCompare(right.action),
        )
        .slice(0, LINES_MAX)
}
