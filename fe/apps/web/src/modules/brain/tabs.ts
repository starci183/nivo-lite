import {
    BRAIN_PART_TABS,
    BRAIN_PARTS,
    DEFAULT_BRAIN_TAB,
    LEGACY_BRAIN_TABS,
    brainTabHref,
    brainTabOfAddress,
} from "@/modules/routes"
import type { BrainPart, BrainTab } from "@/modules/routes"

/** What the address of the Second Brain says: the tab, the view inside it and the parameters that open a form on one. */
interface BrainTabAddress {
    readonly tab: string | undefined
    readonly view: string | undefined
    readonly fact: string | undefined
    readonly edit: string | undefined
    readonly answer: string | undefined
}

/**
 * The page the address asks for. Today's tab and view win; an old tab name opens the page it became (the server forwards it first); an
 * address that only carries a form (an old link to write a fact or to give a fact a new value) opens the facts; anything else opens the
 * to-do inbox.
 */
export const brainTabOf = (address: BrainTabAddress): BrainTab => {
    const named = brainTabOfAddress(address.tab, address.view)
    if (named !== undefined) return named
    const legacy = address.tab === undefined ? undefined : LEGACY_BRAIN_TABS[address.tab]
    if (legacy !== undefined) return legacy
    if (address.fact !== undefined || address.edit !== undefined) return "facts"
    return DEFAULT_BRAIN_TAB
}

/** What an old address carried besides its tab: every other parameter, kept as it was. */
interface LegacyAddress {
    readonly tab: string | undefined
    readonly view: string | undefined
    readonly answer: string | undefined
    readonly params: Readonly<Record<string, string | undefined>>
}

/**
 * Where an old address goes. An old tab name (`?tab=facts`, `?tab=review`) forwards to the page it became, under its tab and view, with
 * every other parameter kept; a link that only names a question to answer belongs to the to-do inbox. Today's addresses stay (null).
 */
export const legacyBrainHrefOf = (address: LegacyAddress): string | null => {
    if (brainTabOfAddress(address.tab, address.view) !== undefined) return null
    const legacy = address.tab === undefined ? undefined : LEGACY_BRAIN_TABS[address.tab]
    if (legacy !== undefined) return brainTabHref(legacy, address.params)
    return address.tab === undefined && address.answer !== undefined
        ? brainTabHref("todo", { answer: address.answer })
        : null
}

/** The start of the id of the panel a tab controls; the tab strip and the panel name each other by it. */
export const BRAIN_PANEL_PREFIX = "brain-panel-"

/** The part of the Second Brain a tab sits in: it decides who can read what is added there. */
export const brainPartOf = (tab: BrainTab): BrainPart =>
    BRAIN_PARTS.find((part) => {
        const tabs: ReadonlyArray<string> = BRAIN_PART_TABS[part]
        return tabs.includes(tab)
    }) ?? "internal"

/** The tab a part opens on: its first. */
export const firstTabOf = (part: BrainPart): BrainTab => BRAIN_PART_TABS[part][0]
