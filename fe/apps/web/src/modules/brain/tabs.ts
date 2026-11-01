import { BRAIN_TABS, DEFAULT_BRAIN_TAB, LEGACY_BRAIN_TABS, brainTabHref } from "@/modules/routes"
import type { BrainTab } from "@/modules/routes"

/** What the address of the Second Brain says: the tab and the parameters that open a form on one. */
interface BrainTabAddress {
    readonly tab: string | undefined
    readonly fact: string | undefined
    readonly edit: string | undefined
    readonly answer: string | undefined
}

/**
 * The tab the address asks for. A named tab wins; an address that only carries a form (an old link to write a fact or to give a
 * fact a new value) opens the tab that form belongs to; anything else opens the queue of what needs doing.
 */
export const brainTabOf = (address: BrainTabAddress): BrainTab => {
    const named = BRAIN_TABS.find((tab) => tab === address.tab)
    if (named !== undefined) return named
    if (address.fact !== undefined || address.edit !== undefined) return "facts"
    return DEFAULT_BRAIN_TAB
}

/**
 * Where an old address goes. The review and unanswered-questions tabs, and a link that only names a question to answer, belong to
 * the queue of what needs doing now; every other address stays where it is (null).
 */
export const legacyBrainHrefOf = (address: BrainTabAddress): string | null => {
    const isLegacyTab = address.tab !== undefined && LEGACY_BRAIN_TABS.includes(address.tab)
    const isAnswerLink = address.tab === undefined && address.answer !== undefined
    return isLegacyTab || isAnswerLink ? brainTabHref("todo", { answer: address.answer }) : null
}

/** The start of the id of the panel a tab controls; the tab strip and the panel name each other by it. */
export const BRAIN_PANEL_PREFIX = "brain-panel-"
