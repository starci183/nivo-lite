/** The fields of a piece of recent work that decide whether two lines are the same. */
interface RecentLine {
    readonly action: string
    readonly title: string
    readonly customer: string
    readonly status: string
}

/** A name that is only a login handle: one word of letters, digits and . _ - (what a member shows when nobody gave a display name). */
const HANDLE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/

/**
 * The name a person is shown by: their display name, or, when the stored name is only the login handle ("nivo-owner"), that handle read
 * as words ("Nivo Owner"). The handle itself is never shown.
 */
export const personNameOf = (name: string): string => {
    const clean = name.trim()
    if (!HANDLE.test(clean)) return clean
    return clean
        .split(/[._-]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
}


/** Folds identical recent work (same title or action, customer and status) into one row with its count, keeping the order of first sight. */
export const groupRecent = <W extends RecentLine>(items: ReadonlyArray<W>): ReadonlyArray<{ readonly work: W; readonly times: number }> => {
    const groups = new Map<string, { work: W; times: number }>()
    for (const work of items) {
        const key = [work.title === "" ? work.action : work.title, work.customer, work.status].join("\u0000")
        const seen = groups.get(key)
        if (seen === undefined) groups.set(key, { work, times: 1 })
        else seen.times += 1
    }
    return [...groups.values()]
}
