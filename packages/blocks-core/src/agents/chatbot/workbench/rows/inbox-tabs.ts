/** The time token the Today tab narrows the list by: the server resolves it from the clock of the run. */
export const TODAY_TOKEN = "$today"

/** The tab the params name: the period wins, then the status; every other state is the all tab. */
export const tabOf = (status: string | null, period: string | null): string => {
    if (period === TODAY_TOKEN) return "today"
    return status === "needs" ? "needs" : "all"
}

/** The params a tab sets, each written or cleared: one tab at a time, so choosing one clears what another set. */
export interface TabParams {
    /** The status the tab chooses; null clears it. */
    readonly status: string | null
    /** The period the tab chooses; null clears it. */
    readonly period: string | null
}

/** What choosing a tab writes. */
export const paramsOfTab = (tab: string): TabParams => {
    if (tab === "today") return { status: null, period: TODAY_TOKEN }
    return { status: tab === "needs" ? "needs" : null, period: null }
}
