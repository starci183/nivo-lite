/** Shortens a text to `max` characters with an ellipsis. */
export const ellipsize = (text: string, max: number): string =>
    text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text

/** Takes lines in order while they fit the budget; stops at the first one that does not. */
export const withinBudget = (lines: ReadonlyArray<string>, budget: number): ReadonlyArray<string> =>
    lines.reduce<{ readonly left: number; readonly out: ReadonlyArray<string>; readonly full: boolean }>(
        (state, line) =>
            state.full || line.length > state.left
                ? { ...state, full: true }
                : { left: state.left - line.length, out: [...state.out, line], full: false },
        { left: budget, out: [], full: false },
    ).out
