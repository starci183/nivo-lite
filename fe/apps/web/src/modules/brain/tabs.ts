import { BRAIN_TABS, DEFAULT_BRAIN_TAB } from "@/modules/routes"
import type { BrainTab } from "@/modules/routes"

/** What the address of the Second Brain says: the tab and the parameters that open a form on one. */
interface BrainTabAddress {
    readonly tab: string | undefined
    readonly fact: string | undefined
    readonly edit: string | undefined
    readonly answer: string | undefined
}

/**
 * The tab the address asks for. A named tab wins; an address that only carries a form (an old link to write a fact, to give a
 * fact a new value or to answer a customer question) opens the tab that form belongs to; anything else opens the sources.
 */
export const brainTabOf = (address: BrainTabAddress): BrainTab => {
    const named = BRAIN_TABS.find((tab) => tab === address.tab)
    if (named !== undefined) return named
    if (address.answer !== undefined) return "gaps"
    if (address.fact !== undefined || address.edit !== undefined) return "facts"
    return DEFAULT_BRAIN_TAB
}

/** The start of the id of the panel a tab controls; the tab strip and the panel name each other by it. */
export const BRAIN_PANEL_PREFIX = "brain-panel-"
