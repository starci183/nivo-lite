import type {
    TeamChatBackgroundStopped,
    TeamChatBackgroundStoppedAction,
    TeamChatBackgroundStoppedView,
    TeamChatMarkView,
} from "@/modules/types"
import { brainTabHref } from "@/modules/routes"

/** Every word a "background work stopped" card needs, in the viewer's language; an unknown code answers the generic words. */
export interface BackgroundStoppedWords {
    readonly nivoName: string
    readonly chip: string
    /** The title of the card for a work and why it stopped; the generic title for a work the web does not know. */
    readonly titleOf: (work: string, reason: string) => string
    readonly detailsLabel: string
    readonly factsLabel: string
    readonly factWork: string
    readonly factReason: string
    readonly factSince: string
    /** What a work is called in the muted line ("Working out policies"); the generic name for a work the web does not know. */
    readonly workOf: (work: string) => string
    /** The one sentence for a reason of a work; the generic sentence for a pair the web does not know. */
    readonly messageOf: (work: string, reason: string) => string
    /** The words of the way out for a target kind; null when the web has no door for it. */
    readonly actionOf: (kind: string) => string | null
    readonly timeOf: (iso: string) => string
    /** The clock and the day of a moment ("15:02 11/11"). */
    readonly sinceOf: (iso: string) => string
    readonly hrefOf: (path: string) => string
}

/** NIVO's own mark: a room and a card it writes wear it, never a person's or an agent's. */
export const NIVO_MARK: TeamChatMarkView = { kind: "nivo", id: "nivo", name: "NIVO", picture: null }

const SEPARATOR = " \u00b7 "

/** Where a target kind opens in the workspace, or null for a kind the web does not know (the card then draws no button). */
const targetPathOf = (kind: string): string | null => {
    if (kind === "brain.policies") return brainTabHref("policies")
    return kind === "brain.documents" ? brainTabHref("sources") : null
}

/** The way out of the card: its words and where it opens; null when the target is unknown. */
const actionOf = (card: TeamChatBackgroundStopped, words: BackgroundStoppedWords): TeamChatBackgroundStoppedAction | null => {
    const path = targetPathOf(card.target.kind)
    const label = words.actionOf(card.target.kind)
    return path === null || label === null ? null : { label, href: words.hrefOf(path) }
}

/**
 * The "work stopped" card of a NIVO message with every word resolved. The codes the back end sent are words here, never shown raw; they
 * stay only in the folded `facts` (work, reason, since), where a person debugging may need them.
 */
export const backgroundStoppedViewOf = (
    card: TeamChatBackgroundStopped,
    words: BackgroundStoppedWords,
): TeamChatBackgroundStoppedView => ({
    mark: NIVO_MARK,
    author: words.nivoName,
    meta: [words.workOf(card.work), words.timeOf(card.since)].join(SEPARATOR),
    chip: words.chip,
    title: words.titleOf(card.work, card.reason),
    message: words.messageOf(card.work, card.reason),
    action: actionOf(card, words),
    detailsLabel: words.detailsLabel,
    factsLabel: words.factsLabel,
    facts: [
        { id: "work", name: words.factWork, value: card.work },
        { id: "reason", name: words.factReason, value: card.reason },
        { id: "since", name: words.factSince, value: words.sinceOf(card.since) },
    ],
})
